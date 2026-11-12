import StaffLogin from '../../components/StaffLogin';

export default function DriverLogin() {
  return (
    <StaffLogin
      role="DRIVER"
      home="/livreur"
      pageTitle="Connexion livreur"
      title="Espace livreur"
      identifierLabel="Téléphone"
      identifierMode="tel"
      wrongRoleMessage="Ce compte n'est pas un compte livreur."
    />
  );
}
