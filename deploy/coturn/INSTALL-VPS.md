# Installer coturn (TURN) sur un VPS — sans Docker

Guide pour Klambo / Eteyelo. Objectif : un relais WebRTC stable sur réseau public
(Wi‑Fi café, 4G, CGNAT), sans Docker.

Hôte recommandé : **Ubuntu 22.04 / 24.04** (ou Debian 12).

**TLS coturn = port 5349** (standard TURN over TLS). Le **443** reste libre pour Nginx / le site.

---

## 1. Prérequis

| Élément | Détail |
|--------|--------|
| VPS | IP publique fixe (IPv4) |
| OS | Ubuntu 22.04+ ou Debian 12 |
| Accès | root ou `sudo` en SSH |
| DNS | un sous-domaine, ex. `turn.klambocore.com` → IP du VPS |
| Pare-feu | ouvrir les ports listés ci‑dessous |
| Eteyelo | variables `TURN_URLS` + `TURN_SECRET` en production |

### Ports à ouvrir (obligatoire)

| Port | Protocole | Rôle |
|------|-----------|------|
| **3478** | UDP + TCP | STUN/TURN classique |
| **5349** | TCP (+ UDP si possible) | TURN TLS (cohabite avec Nginx sur 443) |
| **49152–65535** | UDP | Relais média (plage coturn) |

Exemples UFW :

```bash
sudo ufw allow 22/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
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
sudo sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
echo 'TURNSERVER_ENABLED=1' | sudo tee -a /etc/default/coturn
sudo systemctl enable coturn
```

---

## 3. Générer le secret partagé

Ce secret doit être **identique** dans coturn et dans Eteyelo (`TURN_SECRET`).

```bash
openssl rand -hex 32
```

Garder cette valeur en lieu sûr. Ne pas la committer dans git.

---

## 4. Configurer coturn

```bash
sudo cp /etc/turnserver.conf /etc/turnserver.conf.bak.$(date +%F)
sudo nano /etc/turnserver.conf
```

Contenu minimal (adapter IP + secret + domaine) :

```conf
listening-port=3478
tls-listening-port=5349
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

### (Recommandé) Certificat TLS pour le 5349

Sans certificat, `turns:…:5349` échoue. UDP/TCP **3478** fonctionne déjà.

Nginx tient souvent le 443 : utiliser **webroot** (pas `--standalone` qui prend le 443) :

```bash
sudo apt install -y certbot
# Adapter le chemin webroot Nginx (souvent /var/www/html)
sudo certbot certonly --webroot -w /var/www/html -d turn.klambocore.com
```

Puis ajouter dans `/etc/turnserver.conf` :

```conf
cert=/etc/letsencrypt/live/turn.klambocore.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.klambocore.com/privkey.pem
```

Droits lecture pour coturn :

```bash
sudo setfacl -R -m u:turnserver:rX /etc/letsencrypt/live /etc/letsencrypt/archive
# si setfacl absent :
# sudo chmod 755 /etc/letsencrypt/live /etc/letsencrypt/archive
```

Redémarrer :

```bash
sudo systemctl restart coturn
sudo systemctl status coturn
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

Avec `TURN_EXPAND_URLS=1`, l’API ajoute automatiquement :

- `turn:…:3478?transport=tcp`
- `turns:…:5349?transport=tcp`
- `turn:…:5349`

Option explicite (si expand désactivé) :

```env
TURN_URLS=turn:turn.klambocore.com:3478,turns:turn.klambocore.com:5349?transport=tcp
TURN_EXPAND_URLS=0
```

| Variable | Rôle |
|----------|------|
| `TURN_URLS` | Hôte TURN (un `3478` suffit si expand=1) |
| `TURN_SECRET` | Identique à `static-auth-secret` |
| `TURN_EXPAND_URLS=1` | Ajoute TCP 3478 + turns **5349** |
| `TURN_KEEP_PUBLIC_FALLBACK=1` | Garde Metered en secours |
| `TURN_FORCE_RELAY=0` | `1` = toujours forcer le relais |

Redémarrer Eteyelo après modification du `.env`.

---

## 6. Vérifications

```bash
sudo systemctl is-active coturn
ss -ulnp | grep -E '3478|5349'
ss -tlnp | grep -E '3478|5349'
```

Test : [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)

1. Ajouter `turn:turn.klambocore.com:3478` et/ou `turns:turn.klambocore.com:5349?transport=tcp`
2. Username / password depuis `GET /api/mobile/v1/calls/ice-servers`
3. Vérifier des candidats **`relay`**

---

## 7. Checklist

- [ ] DNS `turn.…` → IP du VPS  
- [ ] Ports **3478** tcp/udp, **5349** tcp/(udp), **49152–65535** udp  
- [ ] `external-ip=` = IP publique  
- [ ] `static-auth-secret` = `TURN_SECRET`  
- [ ] `tls-listening-port=5349` (+ certs si turns)  
- [ ] Coturn actif  
- [ ] Trickle ICE → `relay`  
- [ ] Appel 4G ↔ Wi‑Fi OK  

---

## 8. Dépannage

| Symptôme | Cause fréquente |
|----------|-----------------|
| Pas de `relay` | Pare-feu / `external-ip` / secret différent |
| OK même Wi‑Fi, KO public | 3478 UDP ou plage média fermée |
| `turns:5349` échoue | Certificat absent ou droits lecture |
| Port 443 libre mais TURN KO | Vérifier que coturn écoute bien **5349**, pas 443 |
| Creds refusés | `TURN_SECRET` ≠ `static-auth-secret` |

---

## 9. Sécurité

- Ne jamais committer `TURN_SECRET`  
- Secret long (`openssl rand -hex 32`)  
- `no-cli` dans la conf  
- Renouveler Let’s Encrypt (`certbot renew`)  
