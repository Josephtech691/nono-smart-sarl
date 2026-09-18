const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const mtnMomo = require('../integrations/mtnMomo');
const orangeMoney = require('../integrations/orangeMoney');
const { notifyAdmins, notify } = require('../utils/notify');

async function loadPayment(orderId) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { order: true },
  });

  if (!payment) {
    throw new ApiError(
      404,
      'Paiement introuvable pour cette commande'
    );
  }

  return payment;
}

/**
 * POST /api/payments/:orderId/mtn
 *
 * Initialise un paiement MTN Mobile Money.
 */
const initiateMtn = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(
      400,
      'Le numéro de téléphone MTN est obligatoire'
    );
  }

  const payment = await loadPayment(orderId);

  if (payment.status === 'PAID') {
    throw new ApiError(
      400,
      'Cette commande est deja payee'
    );
  }

  if (payment.method !== 'MTN_MOMO') {
    throw new ApiError(
      400,
      "Le mode de paiement de cette commande n'est pas MTN Mobile Money"
    );
  }

  /**
   * On évite de lancer plusieurs demandes MTN
   * simultanément pour la même commande.
   */
  if (payment.status === 'PROCESSING') {
    throw new ApiError(
      400,
      'Un paiement MTN est deja en cours pour cette commande. Verifiez son statut avant de recommencer.'
    );
  }

  let result;

  try {
    result = await mtnMomo.requestToPay({
      amount: payment.amount,
      phoneNumber,
      externalId: payment.order.orderNumber,
    });
  } catch (error) {
    console.error(
      '[payment] Erreur initialisation MTN:',
      error.response || error.message
    );

    throw new ApiError(
      502,
      "Impossible d'initialiser le paiement MTN Mobile Money"
    );
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PROCESSING',
        phoneNumber,
        transactionRef: result.referenceId,
      },
    }),

    prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        provider: 'mtn_momo',
        status: result.status || 'PENDING',
        rawResponse: result.raw || null,
      },
    }),
  ]);

  res.json({
    message:
      'Paiement initie. Validez la demande recue sur votre telephone.',
    status: 'PROCESSING',
    reference: result.referenceId,
  });
});

/**
 * POST /api/payments/:orderId/orange
 *
 * Initialise un paiement Orange Money.
 *
 * Cette partie reste volontairement inchangée dans son fonctionnement.
 */
const initiateOrange = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { phoneNumber } = req.body;

  const payment = await loadPayment(orderId);

  if (payment.status === 'PAID') {
    throw new ApiError(
      400,
      'Cette commande est deja payee'
    );
  }

  if (payment.method !== 'ORANGE_MONEY') {
    throw new ApiError(
      400,
      "Le mode de paiement de cette commande n'est pas Orange Money"
    );
  }

  const result = await orangeMoney.initiatePayment({
    amount: payment.amount,
    phoneNumber,
    externalId: payment.order.orderNumber,
  });

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PROCESSING',
        phoneNumber,
        transactionRef: result.referenceId,
      },
    }),

    prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        provider: 'orange_money',
        status: result.status,
        rawResponse: result.raw || null,
      },
    }),
  ]);

  res.json({
    message:
      'Paiement initie. Validez la demande recue sur votre telephone.',
    status: 'PROCESSING',
    reference: result.referenceId,
  });
});

/**
 * GET /api/payments/:orderId/status
 *
 * Vérifie réellement le statut du paiement auprès de MTN
 * lorsqu'il s'agit d'un paiement MTN Mobile Money.
 */
const getStatus = asyncHandler(async (req, res) => {
  const payment = await loadPayment(req.params.orderId);

  /**
   * Si ce n'est pas MTN, on conserve le comportement existant.
   */
  if (payment.method !== 'MTN_MOMO') {
    return res.json({
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
    });
  }

  /**
   * Si le paiement est déjà finalisé localement,
   * inutile de refaire un appel MTN.
   */
  if (
    payment.status === 'PAID' ||
    payment.status === 'FAILED' ||
    payment.status === 'CANCELLED' ||
    payment.status === 'REFUNDED'
  ) {
    return res.json({
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      reference: payment.transactionRef,
    });
  }

  /**
   * Une référence MTN est indispensable pour interroger
   * le statut RequestToPay.
   */
  if (!payment.transactionRef) {
    return res.json({
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      reference: null,
    });
  }

  let result;

  try {
    result = await mtnMomo.getRequestToPayStatus(
      payment.transactionRef
    );
  } catch (error) {
    console.error(
      '[payment] Erreur verification statut MTN:',
      error.response || error.message
    );

    /**
     * Une erreur temporaire de communication avec MTN
     * ne signifie PAS que le paiement a échoué.
     */
    return res.status(200).json({
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      reference: payment.transactionRef,
      providerStatus: 'UNKNOWN',
      message:
        'Le statut du paiement est temporairement indisponible. Nouvelle verification necessaire.',
    });
  }

  const providerStatus = String(
    result.status || 'PENDING'
  ).toUpperCase();

  /**
   * MTN confirme le paiement.
   */
  if (providerStatus === 'SUCCESSFUL') {
    /**
     * On vérifie à nouveau l'état en base afin d'éviter
     * de confirmer deux fois la même commande.
     */
    const currentPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { order: true },
    });

    if (currentPayment && currentPayment.status !== 'PAID') {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
          },
        }),

        prisma.paymentTransaction.create({
          data: {
            paymentId: payment.id,
            provider: 'mtn_momo',
            status: 'SUCCESSFUL',
            rawResponse: result.raw || null,
          },
        }),

        prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'CONFIRMED',
          },
        }),

        prisma.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'CONFIRMED',
            note:
              'Paiement MTN Mobile Money confirme',
          },
        }),
      ]);

      await notifyAdmins({
        title: 'Paiement recu',
        message:
          payment.order.orderNumber,
        link:
          `/admin/orders/${payment.orderId}`,
      });
    }

    return res.json({
      status: 'PAID',
      method: payment.method,
      amount: payment.amount,
      reference: payment.transactionRef,
      providerStatus: 'SUCCESSFUL',
    });
  }

  /**
   * MTN indique que le paiement a échoué.
   */
  if (providerStatus === 'FAILED') {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
        },
      }),

      prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          provider: 'mtn_momo',
          status: 'FAILED',
          rawResponse: result.raw || null,
        },
      }),
    ]);

    return res.json({
      status: 'FAILED',
      method: payment.method,
      amount: payment.amount,
      reference: payment.transactionRef,
      providerStatus: 'FAILED',
    });
  }

  /**
   * PENDING ou autre état intermédiaire.
   *
   * On ne modifie pas encore le paiement.
   */
  if (payment.status !== 'PROCESSING') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PROCESSING',
      },
    });
  }

  return res.json({
    status: 'PROCESSING',
    method: payment.method,
    amount: payment.amount,
    reference: payment.transactionRef,
    providerStatus,
  });
});

/**
 * POST /api/payments/:orderId/simulate
 *
 * AIDE AU DEVELOPPEMENT UNIQUEMENT.
 *
 * Cette route permet toujours de tester manuellement le tunnel
 * de paiement en développement.
 */
const simulateSuccess = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(
      403,
      "Cette route n'est pas disponible en production"
    );
  }

  const payment = await loadPayment(req.params.orderId);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
      },
    }),

    prisma.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'CONFIRMED',
      },
    }),

    prisma.orderStatusHistory.create({
      data: {
        orderId: payment.orderId,
        status: 'CONFIRMED',
        note: 'Paiement confirme (simulation dev)',
      },
    }),
  ]);

  await notifyAdmins({
    title: 'Paiement recu',
    message: payment.order.orderNumber,
    link: `/admin/orders/${payment.orderId}`,
  });

  res.json({
    status: 'PAID',
  });
});

module.exports = {
  initiateMtn,
  initiateOrange,
  getStatus,
  simulateSuccess,
};
