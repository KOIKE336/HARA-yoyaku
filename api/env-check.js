export default async function handler(req, res) {
  // CORS許可ヘッダを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // 環境変数の存在確認
  const urlSet = !!process.env.KV_REST_API_URL;
  const tokenSet = !!process.env.KV_REST_API_TOKEN;
  
  console.log('[env-check] URL set:', urlSet, 'TOKEN set:', tokenSet);
  
  res.status(200).json({
    urlSet,
    tokenSet
  });
}