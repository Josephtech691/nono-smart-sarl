// Stockage du jeton de connexion.
// "Se souvenir de moi" coche  -> localStorage (la session survit a la fermeture du navigateur)
// "Se souvenir de moi" decoche -> sessionStorage (effacee a la fermeture de l'onglet)
export const TOKEN_KEY = 'fresh_fish_token';

const attempt = (fn) => {
  try {
    return fn();
  } catch (e) {
    return null; // stockage indisponible (navigation privee, politique du navigateur...)
  }
};

export function getToken() {
  return attempt(() => sessionStorage.getItem(TOKEN_KEY)) || attempt(() => localStorage.getItem(TOKEN_KEY));
}

export function setToken(token, remember = true) {
  clearToken();
  attempt(() => (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token));
}

export function clearToken() {
  attempt(() => localStorage.removeItem(TOKEN_KEY));
  attempt(() => sessionStorage.removeItem(TOKEN_KEY));
}
