# 把 911.COM 部署到 911dj.com

你在 GoDaddy 只有域名、没有主机，所以这里用 **Cloudflare Pages**（免费托管 + 免费函数）
放网站，用 **Cloudflare R2** 存音频文件，最后把 GoDaddy 的域名指过去。
整站有密码保护 —— 没有密码，连页面和音频都打不开。

**费用**：Pages 和域名解析免费。R2 有每月 10 GB 存储的免费额度，
但**开通 R2 需要在 Cloudflare 账户里绑定一张银行卡**（在免费额度内不会扣款）。
如果不想绑卡，就别做第 3 步，网站仍可访问，只是不能上传 —— 那种情况下继续用本地模式即可。

---

## 1. 注册 Cloudflare 并添加域名

1. 打开 <https://dash.cloudflare.com> 注册（免费）。
2. **Add a site** → 输入 `911dj.com` → 选 **Free** 套餐。
3. Cloudflare 会扫描现有解析记录，然后给你**两个名称服务器**，形如
   `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`。**把这两个记下来。**

## 2. 在 GoDaddy 把域名指向 Cloudflare

1. 登录 GoDaddy → **我的产品** → 找到 `911dj.com` → **DNS** / **管理 DNS**。
2. 拉到底部 **名称服务器（Nameservers）** → **更改** → 选 **我将使用自己的名称服务器**。
3. 填入第 1 步那两个 Cloudflare 名称服务器，删掉原来的，保存。
4. 回到 Cloudflare 点 **Done, check nameservers**。通常几分钟生效，最长 24 小时。

> 只改名称服务器，域名所有权仍然在 GoDaddy，续费也还在 GoDaddy。

## 3. 建 R2 存储桶（放音频）

1. Cloudflare 左侧菜单 → **R2** → 按提示开通（需绑卡，免费额度内不扣费）。
2. **Create bucket** → 名称填 `dj911-media` → 位置选自动 → 创建。
3. **不要**开启公共访问。音频只通过登录后的网站读取。

## 4. 部署网站

在这台 Mac 上打开「终端」，逐行执行：

```bash
cd ~/Desktop/911.com
npx wrangler pages project create 911dj --production-branch main
npx wrangler pages deploy .
```

第一次会让你用浏览器登录 Cloudflare，同意授权即可。
（也可以把整个文件夹上传到 GitHub，再在 Cloudflare Pages 里连接仓库自动部署。）

## 5. 配置密码和存储绑定

Cloudflare → **Workers & Pages** → 点开 `911dj` → **Settings**：

1. **Functions → R2 bucket bindings → Add binding**
   - Variable name：`MEDIA`
   - R2 bucket：`dj911-media`
2. **Environment variables → Production** 添加两条，都点 **Encrypt**（加密）：
   - `SITE_PASSWORD` —— 你自己定的访问密码
   - `SESSION_SECRET` —— 一串随机字符串，用下面这条命令生成后粘贴：

```bash
openssl rand -base64 32
```

3. 改完**必须重新部署一次**才会生效：再跑一遍 `npx wrangler pages deploy .`，
   或在 Deployments 里点 **Retry deployment**。

> 没配好这两个变量时，网站会显示「站点还没有配置完成」，不会裸奔。

## 6. 绑定 911dj.com

Pages 项目 → **Custom domains** → **Set up a domain** →
分别添加 `911dj.com` 和 `www.911dj.com`。因为域名已经托管在 Cloudflare，
证书和解析都会自动完成，几分钟后 HTTPS 就能用。

---

## 完成之后

- 打开 <https://911dj.com> → 输入密码 → 进入你的曲库。
- 上传的歌曲存在 R2，**换手机、换电脑登录后都是同一个曲库**。
- 右上角的退出图标可以登出。密码想改就改 `SITE_PASSWORD` 再重新部署；
  改 `SESSION_SECRET` 会让所有已登录的设备立刻失效。

## 关于容量

R2 免费额度 10 GB，大约能放 2000–3000 首 MP3。单曲上限 60 MB。
超出免费额度后按 Cloudflare 的 R2 价格计费（存储约 $0.015/GB/月，且下载不收流量费）。

## 安全说明

- 全站（页面、`/api`、`/media`）都在密码之后，未登录一律返回 401。
- 登录状态是一个签名的 HttpOnly Cookie，有效期 30 天，服务端用 HMAC 校验。
- 密码比较用的是摘要比较，不会因为耗时不同而泄露信息；连续输错 6 次会被限流一分钟。
- 这些措施足够挡住随手扫描的人，但它**不是**为对抗有针对性的攻击设计的。
  不要把这里当成机密资料的保险箱。

## 版权提醒

网站一旦上线，任何拿到密码的人都能下载这些文件。上传你没有权利分发的音乐，
风险由域名和主机的所有者承担；Cloudflare 和 GoDaddy 都会依据 DMCA 投诉处理账户。
放自己的作品、已获授权的曲目，或者只把密码给自己用，最稳妥。
