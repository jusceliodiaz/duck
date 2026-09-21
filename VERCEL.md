# Publicação e relatório de regiões

## Página de lançamento

`index.html` agora é a página Em breve. A loja anterior foi preservada em `loja.html`.
O mosaico usa seis fotos WebP da pasta img e troca suas posições aleatoriamente, com pausa manual e respeito à preferência de movimento reduzido.
`/api/subscribe` recebe os cadastros e os salva no mesmo Upstash Redis configurado abaixo, na chave `duck:launch:subscribers:v1`. E-mails são normalizados e deduplicados, com registro da data e do consentimento para aviso de inauguração. Não há envio automático de mensagens: conectar o provedor de e-mail antes da campanha de lançamento. Sem banco configurado, o formulário informa que o cadastro não ocorreu. Não existe simulação de sucesso.

Site estático com funções Node.js em `api/`. Na Vercel, usar preset Other, sem comando de build, diretório de saída `.`. Publicação não realizada nesta alteração.

## Conectar armazenamento

Conectar um banco Upstash Redis pela integração da Vercel e configurar, somente no servidor:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `REGIONS_ADMIN_KEY`: segredo aleatório longo, usado para acessar o relatório. Não colocar no HTML nem no repositório.

Após configurar, fazer novo deploy. O relatório está em `/admin/regioes.html` e exige a chave a cada consulta. Sem as variáveis, a API recusa a coleta e o popup funciona apenas localmente. O frontend consulta o estado da integração para oferecer compartilhamento somente quando configurada.

O visitante escolhe compartilhar sua cidade. A API valida o CEP com ViaCEP e incrementa contadores por mês/cidade/UF, sem armazenar CEP completo. Não são visitantes únicos e o CEP não comprova localização. Proteção básica de abuso: máximo de dez tentativas por origem IP em 24h; apenas HMAC do IP com expiração é armazenado. Para tráfego elevado, complementar com proteção de bots na Vercel. Não há geolocalização automática.

## Referências da comparação

Análise em 21/09/2026: Shogun (filtro de preço), Japan21 (favoritos e ajuda), Iron Studios (coleções, preços e frete), Limited Edition (categorias e catálogo). LEGO e PBKids retornaram conteúdo limitado; Ri Happy não carregou na consulta. Melhorias adaptadas à pequena coleção: favoritos locais, filtros de preço, guia de tamanhos, relacionados, vistos recentemente e perguntas frequentes. Recursos já existentes foram preservados. Não foram inventadas avaliações, estoque ou promoções.

- https://www.shogunlivraria.com.br/colecionaveis
- https://www.japan21actionfigures.com.br/
- https://ironstudios.com.br/
- https://www.limitededition.com.br/
- https://www.lego.com.br/
- https://www.pbkids.com.br/
- https://www.rihappy.com.br/
- https://viacep.com.br/
- https://vercel.com/docs/functions/runtimes/node-js
- https://upstash.com/docs/redis/features/restapi
