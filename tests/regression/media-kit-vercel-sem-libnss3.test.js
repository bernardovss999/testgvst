// Bug original: na Vercel o /api/media-kit respondia 502 "libnss3.so: cannot open shared object file" e o celular
// (Safari) mostrava "Não deu para gerar o media kit agora". O @sparticuz/chromium só extrai as bibliotecas do sistema
// quando reconhece a AWS Lambda pelas variáveis AWS_EXECUTION_ENV / AWS_LAMBDA_JS_RUNTIME, que a Vercel não define.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RAIZ } from "../servidor.js";
import { ambienteDaVercel } from "../../api/media-kit.mjs";

test("na Vercel (sem variáveis da AWS) o Chromium é avisado para extrair as bibliotecas do Amazon Linux 2023", () => {
  const env = { VERCEL: "1" };
  ambienteDaVercel(env);
  assert.match(env.AWS_LAMBDA_JS_RUNTIME, /nodejs2[02]\.x/);
});

test("não mexe no ambiente quando a própria AWS já identifica o runtime", () => {
  const env = { VERCEL: "1", AWS_EXECUTION_ENV: "AWS_Lambda_nodejs20.x" };
  ambienteDaVercel(env);
  assert.equal(env.AWS_LAMBDA_JS_RUNTIME, undefined);
});

test("o ambiente é ajustado antes de carregar o @sparticuz/chromium", async () => {
  const fonte = await readFile(join(RAIZ, "api/media-kit.mjs"), "utf8");
  const ajuste = fonte.indexOf("ambienteDaVercel(process.env)");
  const importacao = fonte.indexOf('import("@sparticuz/chromium")');
  assert.ok(ajuste > 0 && importacao > 0 && ajuste < importacao);
});
