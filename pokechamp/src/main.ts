import "./style.css";
import { createGame } from "./game/createGame";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Expected #app container to exist before booting PokeChamp.");
}

createGame(app);
