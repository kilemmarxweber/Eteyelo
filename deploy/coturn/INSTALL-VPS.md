# Installer coturn (TURN) sur un VPS — sans Docker

Guide pour Klambo / Eteyelo. Objectif : un relais WebRTC stable sur réseau public
(Wi‑Fi café, 4G, CGNAT), sans Docker.

Hôte recommandé : **Ubuntu 22.04 / 24.04** (ou Debian 12).

---

## 1. Prérequis

| Élément | Détail |
|--------|--------|
| VPS | IP publique fixe (IPv4) |
| Accès | root ou `sudo` en SSH |
| DNS | un sous-domaine, ex. `turn.klambocore.com` → IP du VPS |
| Pare-feu | ouvrir les ports listés ci‑dessous |
| Eteyelo | variables `TURN_URLS` + `TURN_SECRET` en production |

### Ports à ouvrir (obligatoire)

| Port | Protocole | Rôle |
|------|-----------|------|
| **3478** | UDP + TCP | STUN/TURN classique |
| **443** | TCP | TURN TLS (Wi‑Fi publics filtrés) |
| **49152–65535** | UDP | Relais média (plage coturn) |

Exemples UFW :

```bash
sudo ufw allow 22/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 443/tcp
sudo ufw allow 49152:65535/udp
sudo ufw reload
sudo ufw status
```

Chez le fournisseur cloud (Hetzner, OVH, DigitalOcean…) : ouvrir les **mêmes**
ports dans le firewall du panel, pas seulement UFW.

### DNS

Créer un enregistrement **A** :

```text
turn.klambocore.com  →  VOTRE_IP_PUBLIQUE
```

Vérifier :

```bash
dig +short turn.klambocore.com
# doit afficher l'IP du VPS
```

---

## 2. Installer coturn (sans Docker)

```bash
sudo apt update
sudo apt install -y coturn
```

Activer le service :

```bash
# Ubuntu : décommenter / activer
sudo sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
# Si le fichier n'a pas la ligne :
echo 'TURNSERVER_ENABLED=1' | sudo tee -a /etc/default/coturn

sudo systemctl enable coturn
```

---

## 3. Générer le secret partagé

Ce secret doit être **identique** dans coturn et dans Eteyelo (`TURN_SECRET`).

```bash
openssl rand -hex 32
# exemple : a1b2c3d4... (copier la valeur)
```

Garder cette valeur en lieu sûr.

---

## 4. Configurer coturn

Sauvegarder l’ancien fichier puis créer la config :

```bash
sudo cp /etc/turnserver.conf /etc/turnserver.conf.bak.$(date +%F)
sudo nano /etc/turnserver.conf
```

Contenu minimal (adapter `EXTERNAL_IP`, `SECRET`, domaine) :

```conf
listening-port=3478
tls-listening-port=443
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=COLLER_ICI_LE_SECRET_OPENSSL
realm=klambocore.com

# IP publique du VPS (obligatoire)
external-ip=VOTRE_IP_PUBLIQUE

min-port=49152
max-port=65535

no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1
verbose
simple-log
```

Remplacer :

- `VOTRE_IP_PUBLIQUE` → ex. `203.0.113.10`
- `COLLER_ICI_LE_SECRET_OPENSSL` → le secret généré à l’étape 3
- `realm` → votre domaine (ex. `klambocore.com`)

### (Recommandé) TLS sur le port 443

Sans certificat, le chemin `turns:…:443` ne marchera pas. UDP/TCP 3478
fonctionne déjà ; le 443 TLS aide beaucoup sur Wi‑Fi publics.

Avec Certbot (Nginx peut déjà écouter 443 — dans ce cas, soit un autre port TLS
coturn, soit un VPS dédié TURN, soit un reverse trop complexe. Le plus simple :
**coturn écoute 443 sur ce VPS**, et le site web est ailleurs.)

Si le VPS TURN est dédié (pas de site web sur 443) :

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d turn.klambocore.com
```

Puis ajouter dans `/etc/turnserver.conf` :

```conf
cert=/etc/letsencrypt/live/turn.klambocore.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.klambocore.com/privkey.pem
```

Droits lecture pour coturn :

```bash
sudo mkdir -p /etc/coturn
# option : copier les certs ou donner lecture au groupe turnserver
sudo setfacl -R -m u:turnserver:rX /etc/letsencrypt/live /etc/letsencrypt/archive
# si setfacl absent :
# sudo chmod 755 /etc/letsencrypt/live /etc/letsencrypt/archive
```

Redémarrer :

```bash
sudo systemctl restart coturn
sudo systemctl status coturn
```

Logs :

```bash
sudo journalctl -u coturn -f
```

---

## 5. Brancher Eteyelo (API)

Dans le `.env` **production** d’Eteyelo :

```env
TURN_URLS=turn:turn.klambocore.com:3478
TURN_SECRET=le_meme_secret_que_static-auth-secret
TURN_TTL_SEC=3600
TURN_EXPAND_URLS=1
TURN_KEEP_PUBLIC_FALLBACK=1
TURN_FORCE_RELAY=0
```

Explications :

| Variable | Rôle |
|----------|------|
| `TURN_URLS` | Hôte TURN (un seul `3478` suffit ; l’API ajoute TCP + 443) |
| `TURN_SECRET` | Identique à `static-auth-secret` |
| `TURN_EXPAND_URLS=1` | Ajoute TCP 3478 + turns 443 automatiquement |
| `TURN_KEEP_PUBLIC_FALLBACK=1` | Garde Metered en secours si coturn est down |
| `TURN_FORCE_RELAY=0` | Mettre `1` seulement si les appels doivent toujours passer par TURN |

Redémarrer Eteyelo (pm2 / systemd / panel) après modification du `.env`.

---

## 6. Vérifications

### Service local

```bash
sudo systemctl is-active coturn
ss -ulnp | grep 3478
ss -tlnp | grep -E '3478|443'
```

### Test STUN/TURN depuis un PC

Outil en ligne : [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)

1. Ajouter :
   - `turn:turn.klambocore.com:3478`
   - username / password : générés par l’API (voir ci‑dessous) **ou** test temporaire
2. Cliquer *Gather candidates*
3. Vous devez voir des candidats `relay` (pas seulement `host` / `srflx`)

Pour obtenir username/password valides (auth REST) depuis le serveur Eteyelo,
appeler une fois connecté :

```http
GET /api/mobile/v1/calls/ice-servers
Authorization: Bearer <token_mobile>
```

La réponse contient `iceServers[].urls`, `username`, `credential`.

### Test rapide depuis le VPS

```bash
# Coturn fournit turnutils_uclient (paquet coturn)
# Remplacer USER/PASS par ceux de l'API ice-servers
turnutils_uclient -v -u 'EXPIRY:userId' -w 'CREDENTIAL' turn.klambocore.com
```

---

## 7. Checklist finale

- [ ] DNS `turn.…` pointe vers l’IP du VPS  
- [ ] Ports 3478 tcp/udp, 443 tcp, 49152–65535 udp ouverts (UFW + panel cloud)  
- [ ] `external-ip=` = IP publique réelle  
- [ ] `static-auth-secret` = `TURN_SECRET` Eteyelo  
- [ ] `coturn` actif (`systemctl status coturn`)  
- [ ] Trickle ICE montre des candidats `relay`  
- [ ] Appel Klambo entre 2 réseaux différents (ex. 4G ↔ Wi‑Fi) OK  

---

## 8. Dépannage rapide

| Symptôme | Cause fréquente |
|----------|-----------------|
| Pas de candidat `relay` | Pare-feu / `external-ip` faux / secret différent |
| Appels OK même Wi‑Fi, KO réseau public | TURN inaccessible ; vérifier 3478 UDP et plage média |
| `turns:443` échoue | Certificat absent ou port 443 pris par Nginx |
| 401 / creds refusés | `TURN_SECRET` ≠ `static-auth-secret` |
| Coturn ne démarre pas | Syntaxe conf ; voir `journalctl -u coturn` |

Si Nginx occupe déjà le **443** sur le même VPS :

- soit dédier un second VPS / IP au TURN,  
- soit mettre coturn TLS sur un autre port (ex. `5349`) et ajouter dans Eteyelo :  
  `TURN_URLS=turn:turn.klambocore.com:3478,turns:turn.klambocore.com:5349?transport=tcp`  
  avec `TURN_EXPAND_URLS=0` pour ne pas écraser vos URLs.

---

## 9. Rappel sécurité

- Ne jamais committer `TURN_SECRET` dans git  
- Secret long (32+ octets hex)  
- Ne pas exposer l’interface admin coturn (`no-cli` déjà dans la conf)  
- Renouveler le certificat Let’s Encrypt (`certbot renew`)  

Une fois coturn up + `.env` Eteyelo mis à jour, reconstruire / publier l’APK Klambo
n’est pas obligatoire pour le TURN (c’est l’API qui pousse les ICE servers), mais
garder l’app à jour pour le préchauffage d’appel déjà livré côté client.
