import { main as scene1 } from "./scene1.js";
import { main as scene2 } from "./scene2.js";
import { main as scene3 } from "./scene3.js";
import { main as scene4 } from "./scene4.js";

let stop = null;

const run = (fn) => {
  stop && stop();
  const view = document.querySelector(".view");
  while (view.firstChild) {
    view.removeChild(view.firstChild);
  }
  stop = fn(view);
};

window.onload = () => {
  const command = document.querySelector('.command');
  [
    ['scene1', 'Scene 1', scene1],
    ['scene2', 'Scene 2', scene2],
    ['scene3', 'Scene 3', scene3],
    ['scene4', 'Scene 4', scene4],
  ].forEach(([id, text, fn]) => {
    const button = document.createElement('button');
    button.id = id;
    button.innerText = text;
    button.addEventListener('click', () => run(fn))
    command.appendChild(button);
  });
  run(scene1);
};
