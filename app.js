const gameList = document.getElementById('game-list');
const repoOwner = 'TakamiChie';
const repoName = 'boardgame-online';

// ローカル環境かどうかを判定
const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (isLocal) {
  // ローカルの場合、games.jsonを読み込み、失敗したらハードコードされたリストを表示
  fetch('games.json')
    .then(response => response.json())
    .then(games => {
      displayGames(games);
    })
    .catch(() => {
      const games = [
      ];
      displayGames(games);
    });
} else {
  // GitHub Pagesの場合、GitHub APIを使ってサブディレクトリを取得
  fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/`)
    .then(response => response.json())
    .then(data => {
      const dirs = data.filter(item => item.type === 'dir');
      const promises = dirs.map(dir => {
        return fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dir.name}/index.html`)
          .then(res => res.json())
          .then(file => {
            const content = decodeBase64Utf8(file.content);
            const titleMatch = content.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : dir.name;
            return { path: dir.name, title: title };
          })
          .catch(() => ({ path: dir.name, title: dir.name })); // エラー時はディレクトリ名を使用
      });
      return Promise.all(promises);
    })
    .then(games => {
      displayGames(games);
    })
    .catch(error => {
      console.error('Error fetching games:', error);
      gameList.innerHTML = '<li>ゲーム一覧の取得に失敗しました。</li>';
    });
}

function displayGames(games) {
  games.forEach(game => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `${game.path}/index.html`;
    a.textContent = game.title;
    li.appendChild(a);
    gameList.appendChild(li);
  });
}

function decodeBase64Utf8(base64) {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}