// Payments adapter. The live path is manual EFT: nothing is charged in the browser.
// PayFast can be plugged in later. It has no monthly fee (you pay per transaction).
// A GitHub Pages site cannot safely receive PayFast's ITN callback. When you add it,
// verify the payment in a free Supabase Edge Function and only then call the same
// credit path an admin uses today. Do not put the PayFast passphrase in config.js.
// The POST endpoint is https://www.payfast.co.za/eng/process
(function () {
window.MQPayments = {
  provider: 'eft',
  packs: [
    { tokens: 10, rand: 200 },
    { tokens: 25, rand: 500 },
    { tokens: 50, rand: 1000 }
  ],

  beginTokenPurchase(profile, pack) {
    return instruction(profile, {
      kind: 'tokens',
      tokens: pack.tokens,
      amountRand: pack.rand,
      label: pack.tokens + ' tokens'
    });
  },

  beginVip(profile, plan, priceRand) {
    return instruction(profile, {
      kind: 'vip',
      plan: plan,
      amountRand: priceRand,
      label: plan === 'yearly' ? 'VIP for a year' : 'VIP for a month'
    });
  }
};

function instruction(profile, item) {
  const cfg = window.MQ_CONFIG || {};
  const hours = Number(cfg.EFT_CREDIT_HOURS) || 24;
  return {
    provider: 'eft',
    status: 'awaiting_eft',
    reference: profile && profile.user_code,
    hours: hours,
    amountRand: item.amountRand,
    label: item.label,
    kind: item.kind,
    tokens: item.tokens || null,
    plan: item.plan || null,
    accountName: cfg.EFT_ACCOUNT_NAME,
    bank: cfg.EFT_BANK,
    accountNo: cfg.EFT_ACCOUNT_NO,
    branch: cfg.EFT_BRANCH,
    message: item.kind === 'vip'
      ? 'Pay by EFT — VIP is marked within ' + hours + ' hours'
      : 'Pay by EFT — tokens credited within ' + hours + ' hours'
  };
}
})();
