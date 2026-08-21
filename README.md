# Dépenses Communes 💶

Application privée de partage de dépenses à 3 (Sarah, Habib, Yosra). Inspirée
d'un suivi Google Sheets existant : chaque dépense est payée par une personne,
concerne un sous-ensemble des trois, et l'app calcule automatiquement qui a
payé combien, qui doit combien, et les transferts à faire pour équilibrer.

Live à [hbdevelop.github.io/gestion-depense-commune](https://hbdevelop.github.io/gestion-depense-commune/).

## Structure

- `index.html` / `style.css` — la page
- `app.js` — logique (auth, temps réel Firestore, calculs de balances)
- `firebase-config.js` — config publique du projet Firebase + liste des emails autorisés
- `firestore.rules` — règles de sécurité Firestore (à copier dans la console Firebase)

## Sécurité

L'app est servie publiquement sur GitHub Pages, mais les **données** ne le sont pas :

- Connexion via **Google Sign-In** (Firebase Authentication), ou par **lien email**
  (connexion sans mot de passe) pour les comptes non-Google — utile pour un compte
  Yahoo qui n'a pas de compte Google associé.
- Les **règles de sécurité Firestore** (`firestore.rules`) n'autorisent la lecture/écriture
  qu'aux emails listés dans `AUTHORIZED_EMAILS` (`firebase-config.js`). Toute autre personne
  connectée se voit refuser l'accès, même si elle trouve l'URL.

Pour ajouter/retirer une personne autorisée :
1. Modifier `AUTHORIZED_EMAILS` dans `firebase-config.js`
2. Mettre à jour la même liste dans `firestore.rules` et republier les règles
   (console Firebase du projet → Firestore Database → Règles)
3. Si la personne utilise le lien email, ajouter le domaine autorisé si besoin
   (console Firebase → Authentication → Settings → Domaines autorisés)

## Données

- Collection `expenses` : une dépense = date, description, payeur, montant, devise
  (EUR ou TND), et la liste des personnes concernées (`concerns`). La valeur en EUR
  et la part par personne sont recalculées à la volée avec le taux de change courant.
- Document `meta/rates` : taux de change `1 EUR = X TND`, modifiable dans l'app,
  appliqué à toutes les dépenses en TND.

Les mises à jour sont en temps réel (Firestore `onSnapshot`) : les 3 comptes voient
les mêmes données se rafraîchir automatiquement, comme un Google Sheet partagé.

## Développement local

Comme il s'agit de modules JS natifs (`type="module"`), il faut servir les
fichiers via un petit serveur HTTP (pas de `file://`) :

```bash
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080`. `localhost` est déjà autorisé côté
Firebase Auth.

## Déploiement

GitHub Pages sert directement les fichiers statiques depuis la branche
`main`. Un `git push` suffit, le site se met à jour automatiquement.
