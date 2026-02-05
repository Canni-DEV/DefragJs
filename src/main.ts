import './app/styles.css';
import { Game } from './app/Game';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app element');
}

const game = new Game(root);
void game.init();
