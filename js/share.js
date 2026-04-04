// Share utility for PlayRealMoneyGames
window.Share = {
  score: function(score, game, extra) {
    var text = "I scored " + score + " points playing " + game + " on PlayRealMoneyGames! " + (extra || "") + " Can you beat me?";
    var url = "https://playrealmoneygames.com";

    // Try native share API (mobile)
    if (navigator.share) {
      navigator.share({ title: "PlayRealMoneyGames", text: text, url: url }).catch(function() {});
      return;
    }

    // Fallback: show share options
    Share.showDialog(text, url);
  },

  referral: function(code) {
    var url = "https://playrealmoneygames.com?ref=" + code;
    var text = "Join me on PlayRealMoneyGames and get bonus points! Use my referral link:";

    if (navigator.share) {
      navigator.share({ title: "Join PlayRealMoneyGames", text: text, url: url }).catch(function() {});
      return;
    }

    Share.showDialog(text, url);
  },

  showDialog: function(text, url) {
    var existing = document.getElementById("share-dialog");
    if (existing) existing.remove();

    var encodedText = encodeURIComponent(text);
    var encodedUrl = encodeURIComponent(url);

    var dialog = document.createElement("div");
    dialog.id = "share-dialog";
    dialog.className = "modal-overlay";
    dialog.innerHTML =
      '<div class="modal" style="max-width:380px;padding:28px;text-align:center">' +
        '<h3 style="color:#fff;margin-bottom:16px">Share</h3>' +
        '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:20px;flex-wrap:wrap">' +
          '<a href="https://twitter.com/intent/tweet?text=' + encodedText + '&url=' + encodedUrl + '" target="_blank" class="btn btn-primary" style="padding:10px 20px;background:#1DA1F2">Twitter/X</a>' +
          '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '" target="_blank" class="btn btn-primary" style="padding:10px 20px;background:#4267B2">Facebook</a>' +
          '<a href="https://wa.me/?text=' + encodedText + '%20' + encodedUrl + '" target="_blank" class="btn btn-primary" style="padding:10px 20px;background:#25D366">WhatsApp</a>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px">' +
          '<input id="share-link" value="' + url + '" readonly style="flex:1;padding:10px;background:#1a1a3e;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:0.8rem">' +
          '<button onclick="Share.copyLink()" class="btn btn-primary" style="padding:10px 16px">Copy</button>' +
        '</div>' +
        '<button onclick="document.getElementById(\'share-dialog\').remove()" class="btn btn-outline" style="padding:8px 24px">Close</button>' +
      '</div>';

    document.body.appendChild(dialog);
    dialog.addEventListener("click", function(e) {
      if (e.target === dialog) dialog.remove();
    });
  },

  copyLink: function() {
    var input = document.getElementById("share-link");
    input.select();
    document.execCommand("copy");
    var btn = input.nextElementSibling;
    btn.textContent = "Copied!";
    setTimeout(function() { btn.textContent = "Copy"; }, 2000);
  },
};
