(function () {
  'use strict';

  /* ========================================================================
     Fundo: colunas de fotos deslizando
     ------------------------------------------------------------------------
     São 9 fotos para preencher a tela inteira, então alguma repetição é
     inevitável. O que a esconde não é evitá-la, é impedir o olho de fechar o
     padrão: cada coluna recebe a lista girada em um ponto diferente, corre em
     um tempo diferente, em sentido alternado e com atraso negativo próprio.

     Cada coluna leva a mesma lista DUAS vezes; a animação vai até -50%, que
     cai exatamente sobre o início da cópia — o laço fecha sem emenda.
     ======================================================================== */

  var FOTOS = [
    'xerif-sm', 'hero-03-sm', 'cyber-sm', 'ghost-sm', 'hero-02-sm',
    'et-sm', 'dino-sm', 'hero-04-sm', 'cow-sm'
  ];
  var COLUNAS = [
    { giro: 0, dur: 96,  dir: 'normal'  },
    { giro: 4, dur: 132, dir: 'reverse' },
    { giro: 7, dur: 108, dir: 'normal'  },
    { giro: 2, dur: 148, dir: 'reverse' },
    { giro: 5, dur: 118, dir: 'normal'  }
  ];
  var POR_COLUNA = 6;

  var backdrop = document.getElementById('backdrop');

  function montarFundo() {
    if (!backdrop) return false;
    var frag = document.createDocumentFragment();

    COLUNAS.forEach(function (col, n) {
      var strip = document.createElement('div');
      strip.className = 'strip';

      var track = document.createElement('div');
      track.className = 'strip__track';
      track.style.setProperty('--dur', col.dur + 's');
      track.style.setProperty('--dir', col.dir);
      /* atraso negativo: a coluna já começa no meio do percurso, senão as
         cinco arrancariam alinhadas e o padrão apareceria */
      track.style.setProperty('--atraso', '-' + (col.dur / COLUNAS.length * n).toFixed(1) + 's');

      for (var volta = 0; volta < 2; volta++) {
        for (var i = 0; i < POR_COLUNA; i++) {
          var img = document.createElement('img');
          img.src = 'img/' + FOTOS[(col.giro + i) % FOTOS.length] + '.webp';
          img.alt = '';
          img.width = 480;
          img.height = 600;
          img.decoding = 'async';
          img.draggable = false;
          track.appendChild(img);
        }
      }
      strip.appendChild(track);
      frag.appendChild(strip);
    });

    backdrop.appendChild(frag);
    return true;
  }

  montarFundo();
}());
