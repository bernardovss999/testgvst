// Pedido de 01/11: no Performômetro quem comenta é a "Bru", não a "Fer".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RAIZ } from "../servidor.js";

test("Performômetro: comentário assinado por Bru", async () => {
  const h = await readFile(join(RAIZ, "index.html"), "utf8");
  const monte = h.split('id="monte"')[1].split('id="confete"')[0];
  assert.match(monte, /<span class="comentario__autor">Bru comentou:<\/span>/);
  assert.doesNotMatch(monte, /Fer comentou/);
});
