import { useEffect, useMemo, useState } from 'react';
import { Package, PackagePlus, Pencil, Plus, Power, Star } from 'lucide-react';
import { categoriesApi, productsApi } from '../../api/catalog';
import EmptyState from '../../components/EmptyState';
import { RowSkeleton } from '../../components/Skeleton';
import Modal from '../../components/admin/Modal';
import Pagination from '../../components/admin/Pagination';
import ProductFormModal from '../../components/admin/ProductFormModal';
import SearchBox from '../../components/admin/SearchBox';
import StockModal from '../../components/admin/StockModal';
import TabBar from '../../components/admin/TabBar';
import useAdminList from '../../hooks/useAdminList';
import useUrlFilters from '../../hooks/useUrlFilters';
import { toast } from '../../store/toastStore';
import { formatFCFA, formatStock, UNIT_LABELS } from '../../utils/format';
import { activeVariants, availableStock, hasVariants, isLowStock, isOutOfStock, variantAvailable } from '../../utils/products';
import usePageMeta from '../../utils/usePageMeta';

const PAGE_SIZE = 10;
const REFRESH_MS = 60000;
const DEFAULTS = { q: '', categorie: '', stock: '', statut: '', page: '1' };

const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Le catalogue complet (le serveur limite une réponse à 100 produits) : la liste se filtre et se pagine ici, sans nouvel appel.
async function fetchAllProducts() {
  const items = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await productsApi.list({ all: 'true', limit: 100, page });
    items.push(...res.items);
    if (res.items.length === 0 || items.length >= res.total) break;
  }
  return items;
}

function Thumb({ product }) {
  const url = product.images?.[0]?.url;
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-mist text-ink/30" aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Package size={18} />}
    </span>
  );
}

function StockCell({ product }) {
  const available = availableStock(product);
  const out = isOutOfStock(product);
  const low = !out && isLowStock(product);
  const variants = hasVariants(product) ? activeVariants(product) : null;
  const reserved = variants ? variants.reduce((sum, v) => sum + (Number(v.reservedQuantity) || 0), 0) : Number(product.reservedQuantity) || 0;
  const unit = variants ? 'PIECE' : product.unit;
  return (
    <div>
      <p className={`font-semibold ${out ? 'text-red-600' : low ? 'text-amber-700' : 'text-ink'}`}>{formatStock(available, unit)}</p>
      {out ? (
        <span className="badge bg-red-100 text-red-700">Rupture</span>
      ) : low ? (
        <span className="badge bg-amber-100 text-amber-800">Stock bas</span>
      ) : null}
      {reserved > 0 && <p className="text-xs text-ink/45">dont {formatStock(reserved, unit)} réservés</p>}
      {variants && (
        <ul className="mt-1 space-y-0.5 text-xs text-ink/55">
          {variants.map((v) => (
            <li key={v.id}>
              {v.label} : <span className={variantAvailable(v) === 0 ? 'font-semibold text-red-600' : 'font-medium text-ink/75'}>{variantAvailable(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Prix affiché dans la liste : « à partir de » pour un produit à poids multiples.
function PriceCell({ product }) {
  if (hasVariants(product)) {
    const prices = activeVariants(product).map((v) => v.price);
    return (
      <>
        <span className="text-ink/45">dès </span>
        {formatFCFA(Math.min(...prices))} <span className="text-ink/45">/ pièce · {prices.length} poids</span>
      </>
    );
  }
  return (
    <>
      {formatFCFA(product.price)} <span className="text-ink/45">/ {UNIT_LABELS[product.unit] || product.unit}</span>
    </>
  );
}

function StatusBadge({ product }) {
  return <span className={`badge ${product.isActive ? 'bg-brand-500/15 text-brand-700' : 'bg-mist text-ink/55'}`}>{product.isActive ? 'Actif' : 'Inactif'}</span>;
}

function Actions({ product, busy, onStock, onEdit, onToggle }) {
  const icon = 'flex h-9 w-9 items-center justify-center rounded-full text-ink/55 transition hover:bg-mist hover:text-ink disabled:opacity-50';
  return (
    <div className="flex items-center gap-1 md:justify-end">
      <button type="button" data-action="stock" onClick={() => onStock(product)} aria-label={`Ajuster le stock de ${product.name}`} title="Ajuster le stock" className={icon}>
        <PackagePlus size={17} />
      </button>
      <button type="button" data-action="edit" onClick={() => onEdit(product)} aria-label={`Modifier ${product.name}`} title="Modifier" className={icon}>
        <Pencil size={16} />
      </button>
      <button
        type="button"
        data-action="toggle"
        onClick={() => onToggle(product)}
        disabled={busy}
        aria-label={`${product.isActive ? 'Désactiver' : 'Réactiver'} ${product.name}`}
        title={product.isActive ? 'Désactiver (masquer de la boutique)' : 'Réactiver'}
        className={`${icon} ${product.isActive ? 'hover:!bg-red-50 hover:!text-red-600' : 'hover:!bg-brand-500/10 hover:!text-brand-700'}`}
      >
        <Power size={16} />
      </button>
    </div>
  );
}

function Name({ product }) {
  return (
    <div className="min-w-0">
      <p className={`flex items-center gap-1.5 font-semibold ${product.isActive ? 'text-ink' : 'text-ink/50'}`}>
        <span className="truncate">{product.name}</span>
        {product.isFeatured && <Star size={13} className="shrink-0 fill-amber-400 text-amber-500" aria-label="Mis en avant" />}
      </p>
      <p className="truncate text-xs text-ink/50">{product.category?.name || 'Sans catégorie'}</p>
    </div>
  );
}

export default function AdminProducts() {
  usePageMeta('Produits');
  const [filters, setFilters] = useUrlFilters(DEFAULTS);
  const { data, loading, error, reload } = useAdminList(() => fetchAllProducts(), {}, { refreshMs: REFRESH_MS });
  const [categories, setCategories] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formProduct, setFormProduct] = useState(null); // null = nouveau produit
  const [stockTarget, setStockTarget] = useState(null);
  const [confirm, setConfirm] = useState(null); // produit à désactiver
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    categoriesApi.list({ all: 'true' }).then((list) => setCategories(Array.isArray(list) ? list : list?.items || [])).catch(() => setCategories([]));
  }, []);

  const tab = filters.stock === 'low' ? 'low' : filters.statut === 'inactif' ? 'inactive' : '';
  const page = Math.max(1, parseInt(filters.page, 10) || 1);

  const products = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    // Ordre stable (actifs d'abord, puis par nom) : une ligne ne saute pas quand on ajuste son stock.
    return [...list].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'fr'));
  }, [data]);

  const searched = useMemo(() => {
    const terms = normalize(filters.q).split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      if (filters.categorie && p.categoryId !== filters.categorie) return false;
      const haystack = normalize(`${p.name} ${p.category?.name || ''}`);
      return terms.every((t) => haystack.includes(t));
    });
  }, [products, filters.q, filters.categorie]);

  const visible = tab === 'low' ? searched.filter(isLowStock) : tab === 'inactive' ? searched.filter((p) => !p.isActive) : searched;
  const total = visible.length;
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(filters.q || filters.categorie || tab);

  const tabs = [
    { value: '', label: 'Tous', count: data ? searched.length : undefined },
    { value: 'low', label: 'Stock bas', alert: true, count: data ? searched.filter(isLowStock).length : undefined },
    { value: 'inactive', label: 'Inactifs', count: data ? searched.filter((p) => !p.isActive).length : undefined },
  ];

  // Page devenue vide (produit désactivé, filtre plus strict, ancien lien) : retour à la dernière page existante.
  useEffect(() => {
    if (data && total > 0 && pageItems.length === 0 && page > 1) setFilters({ page: Math.ceil(total / PAGE_SIZE) });
  }, [data, total, pageItems.length, page, setFilters]);

  const change = (patch) => setFilters({ ...patch, page: 1 });
  const changeTab = (value) => change({ stock: value === 'low' ? 'low' : '', statut: value === 'inactive' ? 'inactif' : '' });
  const clearFilters = () => change({ q: '', categorie: '', stock: '', statut: '' });

  const openNew = () => {
    setFormProduct(null);
    setFormOpen(true);
  };
  const openEdit = (product) => {
    setFormProduct(product);
    setFormOpen(true);
  };

  const setActive = async (product, isActive) => {
    setBusyId(product.id);
    try {
      if (isActive) await productsApi.update(product.id, { isActive: true });
      else await productsApi.remove(product.id);
      toast.success(isActive ? `« ${product.name} » est de nouveau visible dans la boutique.` : `« ${product.name} » n’est plus visible dans la boutique.`);
      setConfirm(null);
      await reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Modification impossible, réessayez.');
    } finally {
      setBusyId(null);
    }
  };

  const askToggle = (product) => {
    // Réactiver est sans conséquence ; désactiver retire le produit de la boutique, on confirme.
    if (!product.isActive) setActive(product, true);
    else setConfirm(product);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Produits</h1>
          <p className="text-sm text-ink/55">Votre catalogue, les prix et le stock disponible de chaque produit.</p>
        </div>
        <button type="button" onClick={openNew} className="btn-primary !py-2.5 text-sm" data-testid="add-product">
          <Plus size={16} aria-hidden="true" /> Nouveau produit
        </button>
      </div>

      <div className="mt-5">
        <TabBar tabs={tabs} value={tab} onChange={changeTab} label="Produits par état" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <SearchBox value={filters.q} onSearch={(q) => change({ q })} placeholder="Rechercher un produit ou une catégorie…" label="Rechercher un produit" />
        <select aria-label="Catégorie" className="input !w-auto !py-2 text-sm" value={filters.categorie} onChange={(e) => change({ categorie: e.target.value })}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className={`mt-5 transition-opacity ${loading && data ? 'opacity-60' : ''}`} aria-busy={loading}>
        {error && !data ? (
          <EmptyState
            icon={Package}
            title="Chargement impossible"
            description={error}
            action={
              <button type="button" onClick={() => reload()} className="btn-primary mt-2">
                Réessayer
              </button>
            }
          />
        ) : !data ? (
          <RowSkeleton count={6} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={hasFilters ? 'Aucun produit trouvé' : 'Aucun produit pour le moment'}
            description={
              tab === 'low' && !filters.q && !filters.categorie
                ? 'Aucun produit n’a atteint son seuil d’alerte : tout est bien approvisionné.'
                : hasFilters
                  ? 'Aucun produit ne correspond à ces filtres.'
                  : 'Ajoutez votre premier produit pour l’afficher dans la boutique.'
            }
            action={
              hasFilters ? (
                <button type="button" onClick={clearFilters} className="btn-secondary mt-2 !px-4 !py-2 text-sm">
                  Effacer les filtres
                </button>
              ) : (
                <button type="button" onClick={openNew} className="btn-primary mt-2">
                  <Plus size={16} aria-hidden="true" /> Nouveau produit
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm" data-testid="products-table">
                <thead className="border-b border-line bg-mist/60 text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Produit</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Prix</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Stock disponible</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pageItems.map((p) => (
                    <tr key={p.id} className={`transition hover:bg-mist/40 ${p.isActive ? '' : 'bg-mist/30'}`} data-product={p.name}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb product={p} />
                          <Name product={p} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink/75">
                        <PriceCell product={p} />
                      </td>
                      <td className="px-4 py-3">
                        <StockCell product={p} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge product={p} />
                      </td>
                      <td className="px-4 py-3">
                        <Actions product={p} busy={busyId === p.id} onStock={setStockTarget} onEdit={openEdit} onToggle={askToggle} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" data-testid="products-cards">
              {pageItems.map((p) => (
                <li key={p.id} className={`card p-4 ${p.isActive ? '' : 'bg-mist/40'}`} data-product={p.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Thumb product={p} />
                      <Name product={p} />
                    </div>
                    <StatusBadge product={p} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                    <div>
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Prix</p>
                      <p className="text-ink/80">
                        <PriceCell product={p} />
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">Stock disponible</p>
                      <StockCell product={p} />
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Actions product={p} busy={busyId === p.id} onStock={setStockTarget} onEdit={openEdit} onToggle={askToggle} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onChange={(p) => {
                  setFilters({ page: p });
                  window.scrollTo({ top: 0 });
                }}
              />
            </div>
          </>
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        product={formProduct}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, isNew) => {
          setFormOpen(false);
          toast.success(isNew ? 'Produit créé' : 'Produit mis à jour');
          reload({ silent: true });
        }}
      />

      <StockModal
        product={stockTarget}
        onClose={() => setStockTarget(null)}
        onDone={(updated, delta, variant) => {
          setStockTarget(null);
          const label = variant ? `${updated.name} (${variant.label})` : '';
          const fresh = variant ? updated.variants.find((v) => v.id === variant.id) : null;
          const stock = fresh ? fresh.stockQuantity : updated.stockQuantity;
          const unit = variant ? 'PIECE' : updated.unit;
          toast.success(`Stock de « ${label || updated.name} » : ${formatStock(stock, unit)} (${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')})`);
          reload({ silent: true });
        }}
      />

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        busy={Boolean(confirm && busyId === confirm.id)}
        icon={Power}
        title="Désactiver ce produit ?"
        description={confirm ? `« ${confirm.name} » ne sera plus visible dans la boutique. Les commandes déjà passées ne changent pas, et vous pourrez le réactiver à tout moment.` : ''}
      >
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setConfirm(null)} disabled={Boolean(confirm && busyId === confirm.id)} className="btn-secondary !py-3" data-autofocus>
            Annuler
          </button>
          <button
            type="button"
            onClick={() => confirm && setActive(confirm, false)}
            disabled={Boolean(confirm && busyId === confirm.id)}
            className="btn-primary !bg-red-600 !py-3 hover:!bg-red-700"
            data-testid="confirm-deactivate"
          >
            {confirm && busyId === confirm.id ? 'Désactivation…' : 'Désactiver'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
