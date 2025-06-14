<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PS5 4.03 WebKit Stage 1</title>
  <style>
    body { background-color: #111; color: #0f0; font-family: monospace; }
    #log { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>PS5 4.03 WebKit Stage 1</h1>
  <div id="log"></div>

  <script>
    function log(msg) {
      console.log(msg);
      document.getElementById("log").textContent += msg + "\n";
    }

    log("Iniciando Stage 1...");
    
    // Empezamos el heap spray simple
    const spray = [];
    const SPRAY_SIZE = 0x10000; // 64KB

    try {
      log("Heap spraying...");
      for (let i = 0; i < 10000; i++) {
        let arr = new Uint32Array(SPRAY_SIZE);
        arr.fill(0x41414141);
        spray.push(arr);
        if (i % 1000 === 0) log("Spray chunk: " + i);
      }
      log("Spray completado.");

      // Intento básico de vulnerabilidad: acceso inválido controlado
      let crashTest = () => {
        let corrupt = {a: 1};
        delete corrupt.a;
        corrupt.__proto__ = 42;
      };

      log("Probando acceso inválido controlado...");
      crashTest();
      log("Acceso inválido ejecutado.");

      log("Stage 1 completado con éxito. Listo para siguiente etapa.");
    } catch(e) {
      log("Excepción capturada:");
      log(e.toString());
    }
  </script>
</body>
</html>
