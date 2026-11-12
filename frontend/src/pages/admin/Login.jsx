import StaffLogin from '../../components/StaffLogin';

export default function AdminLogin() {
  return (
    <StaffLogin
      role="ADMIN"
      home="/admin"
      pageTitle="Connexion administration"
      title="Administration"
      identifierLabel="Téléphone ou email"
      wrongRoleMessage="Ce compte n'a pas accès à l'administration."
    />
  );
}
