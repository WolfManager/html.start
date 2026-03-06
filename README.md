# MAGNETO Search

MAGNETO este un motor de cautare cu layout in 3 zone:

- stanga: vreme locala pe baza GPS
- centru: campul principal de cautare
- dreapta: asistent de sugestii tip chatbot

## Structura

- `index.html` - pagina principala (`www.magneto.com` branding)
- `results.html` - pagina de rezultate intermediate
- `styles.css` - stilizare globala si responsive
- `script.js` - logica de cautare, meteo, chatbot si rezultate

## Rulare locala

Deschide `index.html` in browser sau foloseste Live Server in VS Code.

## Publicare (deploy)

1. Publica proiectul pe un host static: GitHub Pages, Netlify sau Vercel.
2. Configureaza domeniul custom `www.magneto.com` in platforma de hosting.
3. In DNS:
   - adauga `CNAME` pentru `www` catre domeniul host-ului,
   - optional redirect de la root (`magneto.com`) catre `www.magneto.com`.
4. Activeaza HTTPS in platforma de hosting.

## SEO minim

Proiectul include:

- `robots.txt`
- `sitemap.xml`

Actualizeaza URL-urile daca schimbi structura paginilor.
