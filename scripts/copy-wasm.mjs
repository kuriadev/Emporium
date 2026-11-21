import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm");
const target = join(process.cwd(), "public/lottie/dotlottie-player.wasm");

if (existsSync(source)) {
  mkdirSync(join(process.cwd(), "public/lottie"), { recursive: true });
  copyFileSync(source, target);
}
