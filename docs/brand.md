# Identidade Mandalart

A marca usa o nome **Mandalart**, com a mesma capitalização e tipografia. No logo, **Mandal** permanece escuro e **art** recebe o gradiente índigo 600 → roxo 600, da esquerda para a direita.

- `app/components/Brand.tsx`: componentes compartilhados `BrandIcon`, `BrandWordmark` e `BrandLogo`. Reutilize o componente para manter o destaque em `art` consistente.
- `app/globals.css`: `--brand-start`, `--brand-end`, `--brand-gradient` e `--brand-gradient-hover` centralizam as cores. `brand-text`, `brand-button` e `brand-surface` aplicam a identidade a destaques, ações principais e superfícies.
- `public/mandalart-logo.svg`: ícone vetorial oficial, com quatro quadrados e um único gradiente contínuo. Os equivalentes sRGB dos extremos são `#4f39f6` e `#9810fa`.
- `public/mandalart-logo.png`, `app/icon.png` e `app/apple-icon.png`: versões rasterizadas do mesmo SVG, em 512, 512 e 180 pixels. A versão Apple tem fundo branco.

O gradiente aparece nos destaques principais, botões e progresso. Textos de leitura usam neutros escuros; textos sobre o gradiente usam branco. Sucesso, atenção e erro conservam suas cores semânticas. No modo de alto contraste, os textos em gradiente voltam à cor do sistema.

Novas telas devem reutilizar esses componentes e estilos, sem recriar a logo ou definir outro gradiente principal.
