(function () {
  'use strict';
  document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var status = document.getElementById('reportStatus');
    var rows = document.getElementById('reportRows');
    var input = document.getElementById('reportKey');
    var button = this.querySelector('button');
    button.disabled = true; status.textContent = 'Consultando…'; rows.replaceChildren();
    try {
      var response = await fetch('/api/regions', {headers:{Authorization:'Bearer '+input.value},signal:AbortSignal.timeout(10000)});
      var result = await response.json();
      if(!response.ok) throw new Error(result.error || 'Consulta indisponível.');
      result.rows.forEach(function(row) {
        var tr = document.createElement('tr');
        [row.month,row.city,row.uf,row.count].forEach(function(value) { var td=document.createElement('td'); td.textContent=String(value); tr.appendChild(td); });
        rows.appendChild(tr);
      });
      status.textContent = result.rows.length ? 'Relatório atualizado.' : 'Ainda não há regiões registradas.';
    } catch(e) { status.textContent = 'Não foi possível carregar. Confira a chave e a configuração do serviço.'; }
    finally { input.value=''; button.disabled=false; }
  });
}());
