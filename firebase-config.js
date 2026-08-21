// Config du projet Firebase "gestion-depense-commune" (console.firebase.google.com).
// Ces clés sont publiques par design (elles identifient juste le projet, elles n'autorisent rien
// en elles-mêmes) : la vraie sécurité vient des règles Firestore (voir firestore.rules et le
// README) qui limitent la lecture/écriture aux comptes autorisés.
//
// Volontairement, la liste des emails autorisés ne vit pas dans ce fichier : c'est un module
// JS servi tel quel à n'importe quel visiteur du site, donc tout ce qu'il contient est public.
// app.js ne fait jamais de vérification d'autorisation côté client — il tente juste de lire
// les données et laisse les règles Firestore (côté serveur, jamais téléchargeables) décider.
export const firebaseConfig = {
  apiKey: "AIzaSyA6rLibk_QOoOm_Fzpkw-w9X3m6hQGNs-o",
  authDomain: "gestion-depense-commune.firebaseapp.com",
  projectId: "gestion-depense-commune",
  storageBucket: "gestion-depense-commune.firebasestorage.app",
  messagingSenderId: "934779108764",
  appId: "1:934779108764:web:3438c60e8f15f56fa99c59"
};

// ID client OAuth Web du provider Google (Firebase Auth > Sign-in method > Google >
// Configuration du SDK Web). Utilisé par Google Identity Services pour la connexion :
// on évite ainsi le relais par iframe tierce de Firebase, souvent bloqué par les
// navigateurs qui restreignent le stockage/cookies tiers.
export const GOOGLE_CLIENT_ID = "934779108764-13eetjam5laa4blbmh40p2cqkqatu8j8.apps.googleusercontent.com";
