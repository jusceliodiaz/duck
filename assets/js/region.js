(function () {
  "use strict";
  var dialog = document.getElementById("regionDialog");
  var input = document.getElementById("regionCep");
  var error = document.getElementById("regionError");
  var submit = document.getElementById("regionSubmit");
  var forget = document.getElementById("regionForget");
  var region = null, controller = null;
  function read(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch(e) {} }
  try { var saved = JSON.parse(read("dd_region_v1")); if(saved && /^\d{8}$/.test(saved.cep) && typeof saved.city === "string" && /^[A-Z]{2}$/.test(saved.uf)) region = saved; } catch(e) {}
  function render() { document.getElementById("regionLabel").textContent = region ? region.city + " / " + region.uf : "Seu CEP"; forget.hidden = !region; }
  function close() { if(controller) controller.abort(); dialog.close(); save("dd_region_dismissed_v1", "1"); }
  function open() { error.textContent = ""; input.removeAttribute("aria-invalid"); input.value = region ? region.cep.slice(0,5) + "-" + region.cep.slice(5) : ""; dialog.showModal(); input.focus(); }
  document.getElementById("regionBtn").addEventListener("click", open);
  document.getElementById("regionClose").addEventListener("click", close);
  document.getElementById("regionSkip").addEventListener("click", close);
  dialog.addEventListener("cancel", function(e) { e.preventDefault(); close(); });
  dialog.addEventListener("close", function() { document.getElementById("regionBtn").focus(); });
  forget.addEventListener("click", function() { region = null; save("dd_region_v1", "null"); input.value = ""; render(); error.textContent = "Região removida deste navegador."; input.focus(); });
  input.addEventListener("input", function() { var digits = input.value.replace(/\D/g, "").slice(0,8); input.value = digits.length > 5 ? digits.slice(0,5) + "-" + digits.slice(5) : digits; error.textContent = ""; input.removeAttribute("aria-invalid"); });
  document.getElementById("regionForm").addEventListener("submit", async function(e) {
    e.preventDefault(); var cep = input.value.replace(/\D/g, "");
    if(cep.length !== 8) { error.textContent = "Informe os 8 números do CEP."; input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    if(controller) return;
    controller = new AbortController(); var timeout = setTimeout(function() { if(controller) controller.abort(); }, 8000);
    submit.disabled = true; submit.textContent = "Consultando…"; input.readOnly = true; error.textContent = "";
    try {
      var response = await fetch("https://viacep.com.br/ws/" + cep + "/json/", {signal: controller.signal});
      if(!response.ok) throw new Error("network"); var data = await response.json();
      if(data.erro || !data.localidade || !data.uf) { error.textContent = "CEP não encontrado. Confira os números."; input.setAttribute("aria-invalid", "true"); return; }
      if(!dialog.open) return;
      region = {cep: cep, city: data.localidade, uf: data.uf}; save("dd_region_v1", JSON.stringify(region)); render(); close();
    } catch(e) { if(dialog.open) error.textContent = "Não foi possível consultar agora. Tente novamente ou continue sem informar."; }
    finally { clearTimeout(timeout); controller = null; submit.disabled = false; submit.textContent = "Salvar região →"; input.readOnly = false; }
  });
  render();
  if(!region && !read("dd_region_dismissed_v1")) setTimeout(function() { if(!document.body.classList.contains("is-locked")) open(); }, 1200);
}());
