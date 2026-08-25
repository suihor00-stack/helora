# HELORA

> Hello, Aura. — distinctive jewelry for everyday expression.

An online jewelry shop: plain HTML, CSS and JavaScript, hosted on Cloudflare
Pages, with Supabase behind it for products and orders. No build step and
nothing to install.

**Start here → [CLAUDE.md](CLAUDE.md)** — setup, deploying, and how to add
products.

### Quick preview

```bash
python3 serve.py
```

Then open <http://localhost:8788>.

### What's where

| | |
|---|---|
| `index.html` | the shop |
| `admin.html` | add and edit products |
| `js/config.js` | your Supabase keys and shop settings |
| `css/helora.css` | all styling — colours live in `:root` at the top |
| `supabase/schema.sql` | the database, run once in Supabase |

Design source: Claude Design project *UI mockups needed* → `HELORA Site.dc.html`.
