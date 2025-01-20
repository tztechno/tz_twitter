
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

// APIクライアントの初期化
const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// 認証テスト関数
async function testAuthentication() {
    try {
        const me = await client.v2.me();
        console.log('認証成功:', me.data);
        return true;
    } catch (error) {
        console.error('認証エラー:', {
            status: error.code,
            message: error.message,
            data: error.data
        });
        return false;
    }
}

// APIレート制限の確認
// レート制限の確認関数を修正
async function checkRateLimit() {
    try {
        // v2 APIでのレート制限確認
        const response = await client.v2.get('users/me');
        // レート制限情報はレスポンスヘッダーに含まれています
        console.log('API制限状況:', {
            remaining: response._headers.get('x-rate-limit-remaining'),
            limit: response._headers.get('x-rate-limit-limit'),
            reset: response._headers.get('x-rate-limit-reset')
        });
        return response._headers;
    } catch (error) {
        console.error('レート制限確認エラー:', error);
        throw error;
    }
}

// ツイート投稿関数
async function postTweet(tweetText) {
    try {
        // ツイートを投稿
        const tweet = await client.v2.tweet(tweetText);
        console.log('ツイートを投稿しました:', tweet.data.text);
        return tweet;
    } catch (error) {
        if (error.code === 403) {
            console.error('権限エラー: APIキーとトークンを確認してください');
            console.error('エラー詳細:', error.data);
        } else if (error.code === 429) {
            console.error('レート制限に達しました');
        } else {
            console.error('ツイート投稿中にエラーが発生しました:', error);
        }
        throw error;
    }
}

// 定期投稿関数
async function schedulePost() {
    try {
        // レート制限を確認
        await checkRateLimit();

        const tweetText = `自動投稿テストです。\n現在時刻: ${new Date().toLocaleString('ja-JP')}`;
        await postTweet(tweetText);
    } catch (error) {
        console.error('定期投稿中にエラーが発生しました:', error);

        // エラーが発生した場合、次回の実行までの待機時間を調整
        if (error.code === 429) {
            console.log('レート制限により15分待機します...');
            await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
        }
    }
}

// エラーハンドリング用のユーティリティ関数
function handleError(error) {
    console.error('エラーが発生しました:', {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString()
    });

    // エラーログをファイルに保存することもできます
    // require('fs').appendFileSync('error.log', `${new Date().toISOString()}: ${error.message}\n`);
}

// プログラムのメイン実行部分
(async () => {
    try {
        // 認証チェック
        const isAuthenticated = await testAuthentication();
        if (!isAuthenticated) {
            console.error('認証に失敗したため、処理を中止します');
            process.exit(1);
        }

        // レート制限の確認
        await checkRateLimit();

        // 初回の投稿
        await postTweet('Twitter API テスト開始');

        // 定期投稿の開始（1時間ごと）
        setInterval(schedulePost, 60 * 60 * 1000);

        console.log('定期投稿を開始しました');
    } catch (error) {
        handleError(error);
        process.exit(1);
    }
})();

// プロセスの終了時の処理
process.on('SIGINT', async () => {
    console.log('\n終了処理を開始します...');
    try {
        await postTweet('自動投稿を終了します');
        console.log('正常に終了しました');
        process.exit(0);
    } catch (error) {
        console.error('終了処理中にエラーが発生しました:', error);
        process.exit(1);
    }
});
