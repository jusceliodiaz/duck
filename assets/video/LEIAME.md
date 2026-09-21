# Vídeo do hero — especificação

Os três arquivos desta pasta vêm de `img/hero_01.webm`. Para trocar por outro
vídeo, basta substituí-los mantendo exatamente os mesmos nomes — nenhuma linha
de HTML, CSS ou JS precisa mudar.

> **O que foi feito com o arquivo original:** ele não fechava o loop (o salto do
> último para o primeiro quadro era ~4× maior que um passo normal, dando um
> tranco visível a cada 5 s). Os últimos 0,4 s passaram a receber o início do
> vídeo em *crossfade*, o que derrubou o salto para o tamanho de um quadro
> normal. A duração caiu de 5,04 s para 4,67 s. O original segue intacto em
> `img/hero_01.webm`.

| Arquivo | O que é | Obrigatório |
|---|---|---|
| `hero.webm` | VP9, servido primeiro (arquivo menor) | opcional |
| `hero.mp4` | H.264, o que garante compatibilidade | **sim** |
| `hero-poster.webp` | 1º quadro; aparece antes de carregar e quando o vídeo está pausado | **sim** |

---

## Formato

- **Resolução: 1920 × 1080** (16:9). É o que o placeholder usa e o que o layout assume.
  2560 × 1440 também funciona e só aumenta o peso; abaixo de 1920 começa a borrar em monitor 2K.
- **Duração: 8 a 12 segundos.** É um loop de fundo, não um filme — quanto mais curto, menor o arquivo.
- **Taxa: 30 fps.**
- **Sem áudio.** A faixa de som é ignorada (o vídeo roda `muted`, senão o navegador bloqueia o autoplay).
- **Peso: até ~1,5 MB no `.mp4`.** O atual está em 833 KB (webm: 1,1 MB).
- **O loop precisa fechar:** o último quadro tem que encostar no primeiro, senão
  pula a cada volta. Se não fechar, dá para costurar com crossfade:

```bash
# D = duração, T = crossfade (0.4s costuma bastar), CORTE = D - T
ffmpeg -i entrada.webm -filter_complex "\
[0:v]split=3[pre][body][tail];\
[pre]trim=start=0:end=0.4,setpts=PTS-STARTPTS,format=yuva420p,fade=t=in:st=0:d=0.4:alpha=1[fadein];\
[tail]trim=start=CORTE,setpts=PTS-STARTPTS[tailv];\
[tailv][fadein]overlay=format=auto[emenda];\
[body]trim=start=0.4:end=CORTE,setpts=PTS-STARTPTS[meio];\
[emenda][meio]concat=n=2:v=1:a=0[out]" -map "[out]" \
-c:v libvpx-vp9 -crf 33 -b:v 0 -row-mt 1 -pix_fmt yuv420p -an saida.webm
```

Comandos de exportação, se ajudar:

```bash
# mp4 (H.264) — o essencial
ffmpeg -i entrada.mov -c:v libx264 -preset slow -crf 27 \
       -pix_fmt yuv420p -movflags +faststart -an hero.mp4

# webm (VP9) — opcional, ~4x menor
ffmpeg -i entrada.mov -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 \
       -pix_fmt yuv420p -an hero.webm

# poster: primeiro quadro
ffmpeg -i entrada.mov -frames:v 1 -q:v 78 hero-poster.webp
```

---

## Zona segura — a parte que importa

O hero é uma **faixa larga**: ocupa 100% da largura da tela e sua altura fica
entre 690 px e 840 px. Um vídeo 16:9 nunca cabe inteiro nessa proporção — o
navegador usa `object-fit: cover`, preenche a largura e **corta em cima e
embaixo**.

Quanto sobra da altura do vídeo (medido no navegador):

| Largura da tela | Altura do hero | Quanto se vê do vídeo |
|---|---|---|
| 1024 px | 754 px | 100% (não corta) |
| 1440 px | 688 px | ~85% da altura |
| 1920 px | 738 px | ~68% |
| **2560 px** | **841 px** | **~58%** |
| 3440 px (ultrawide) | 840 px | ~42% |

Por isso:

```
┌──────────────────────── 1920 ────────────────────────┐
│  ▒▒▒▒▒▒▒▒ topo cortado em telas largas ▒▒▒▒▒▒▒▒▒▒▒▒  │  0%
│                                                      │
├──────────────────────────────────────────────────────┤  30%  ← 324 px
│                    │                                 │
│   texto do site    │   ZONA SEGURA                   │
│   fica aqui        │   o assunto do vídeo vai aqui   │
│   (não coloque     │                                 │
│    nada importante)│                                 │
├──────────────────────────────────────────────────────┤  70%  ← 756 px
│  ▒▒▒▒▒▒▒▒ base cortada em telas largas ▒▒▒▒▒▒▒▒▒▒▒▒  │  100%
└──────────────────────────────────────────────────────┘
        0%          45%                          100%
```

- **Vertical: entre 30% e 70%** (y de 324 px a 756 px). Essa faixa aparece em
  qualquer tela. Deixe topo e base propositalmente vazios.
- **Horizontal: o assunto vive no centro/direita.** A metade esquerda fica sob o
  véu que segura o contraste do título: o que estiver lá aparece bem escurecido.
- O corte é **ancorado um pouco acima do meio** (`object-position: center 32%`),
  para a cabeça do pato não sair em telas largas.

## No celular (telas até 900 px)

O layout muda: o vídeo deixa de ser fundo e vira uma **faixa no topo**, de 50vh
(no máximo 400 px), com o texto abaixo dela sobre fundo sólido.

Nessa faixa o vídeo **não perde altura, só largura**: aparecem os 100% da altura
e cerca de 60% da largura, com o enquadramento em `object-position: 74% center`
— ou seja, a fatia **direita** do vídeo. É mais um motivo para o assunto estar à
direita.

## Fundo

O vídeo instalado é uma **cena noturna** (neon, roxo e azul escuros). Por causa
disso o hero é a **única parte escura do site**: o véu escurece em vez de clarear
e, acima de 900 px, o texto do hero e o menu flutuante viram claros. Um véu na
cor creme sobre uma cena noturna vira lama e mata o neon.

Medido no navegador: o texto do hero fica entre **7,7:1 e 19:1** de contraste e a
metade direita mantém saturação ~0,47, ou seja, o neon continua vivo.

**Se trocar por um vídeo claro**, este tratamento precisa voltar atrás: o véu
(`.hero__veil`) e o bloco `@media (min-width: 901px)` logo acima de `.hero__in`,
no `style.css`, mais as regras `.header:not(.is-stuck)`. São três pontos, todos
comentados no arquivo.

## Acessibilidade

O vídeo é decorativo (`aria-hidden`), roda mudo, em loop e sem controles.

Quem tem `prefers-reduced-motion: reduce` ligado no sistema não vê o vídeo tocar
— recebe só o poster. Por isso o **poster precisa ser um quadro representativo**,
não uma tela preta.

> **Ressalva:** não há mais botão de pausa (removido a pedido). O critério
> WCAG 2.2.2 pede um jeito de parar qualquer movimento automático que passe de
> 5 segundos, e um loop infinito se enquadra nisso. O respeito ao
> `prefers-reduced-motion` cobre quem já declarou a preferência no sistema, mas
> não é equivalente. Se quiser voltar ao conforme, dá para pôr um controle
> discreto no canto do hero.
