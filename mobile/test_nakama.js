const { Client } = require('./node_modules/@heroiclabs/nakama-js/dist/nakama-js.cjs.js');
async function test() {
  const cli = new Client("defaultkey", "127.0.0.1", "7350", false);
  try {
    const sess = await cli.authenticateEmail("unknown123@gmail.com", "password123", false, undefined);
    console.log("Logged in. Created?", sess.created);
  } catch (e) {
    console.error("Error:", e.message || String(e));
    if (e.json) {
       try { const j = await e.json(); console.error(j); } catch(_) {}
    }
  }
}
test();
