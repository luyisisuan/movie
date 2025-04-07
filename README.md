# Neural Cinematek // 个人影像数据库 v3.8

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> "在霓虹闪烁、信息洪流的都市丛林中，记忆如同易碎的数据片段。这个终端，是你私人定制的观影记录核心，一个用于归档、索引和管理你流淌在赛博空间中光影体验的工具。"

一个基于 HTML, CSS 和 JavaScript 构建的纯前端电影收藏管理应用，拥有浓厚的赛博朋克视觉风格。所有数据存储在你的浏览器本地存储 (localStorage) 中，无需后端服务。

![应用截图预览](![image](https://github.com/user-attachments/assets/ab4a3744-74d7-4cae-9734-85519ae115bd)
)

---

## :: 功能特性 (Functionalities) ::

*   **影像数据库:** 以赛博朋克风格卡片展示你的电影收藏，按打分日期（最新在前）排序。
*   **数据自动同步 (TMDb):**
    *   添加新电影时，若未提供导演、年份、国家/地区、海报信息，将自动尝试从 The Movie Database (TMDb) 获取。
    *   提供批量同步功能，为库中缺少信息的条目补充数据。
*   **手动数据录入:** 通过简洁的界面添加新的电影记录（仅需输入标题、评分、打分日期、短评）。
*   **记录修改与覆写:** 编辑已存在的电影信息，包括手动添加/修改豆瓣等外部链接。
*   **数据导入/导出 (CSV):**
    *   支持从特定格式的 CSV 文件批量导入电影数据（自动去重）。
    *   可将整个电影数据库导出为 CSV 文件备份。
*   **节点管理:**
    *   单独清除（删除）任意电影记录。
    *   批量清除（删除）选中的电影记录。
    *   一键清除（删除）所有记录（需二次确认）。
*   **分页浏览:** 流畅的分页加载，便于管理大量数据。
*   **接口配置:** 需在设置中配置你自己的 TMDb API Key 以启用自动获取功能。
*   **外部链接辅助:** 提供便捷按钮，根据输入的电影标题在豆瓣进行搜索。

## :: 技术栈 (Tech Stack) ::

*   **核心:** HTML5, CSS3, Vanilla JavaScript (ES6+)
*   **数据存储:** 浏览器 Local Storage
*   **外部数据源:** The Movie Database (TMDb) API v3
*   **风格灵感:** Cyberpunk, Glitch Art, Neon Noir

## :: 安装与运行 (Setup & Execution) ::

这是一个纯前端应用，无需复杂安装。

1.  **获取代码:** 克隆 (clone) 或下载此仓库到你的本地计算机。
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```
2.  **获取 TMDb API Key (必需步骤):**
    *   访问 [https://www.themoviedb.org/](https://www.themoviedb.org/) 并注册/登录账号。
    *   进入 个人设置 -> API -> 创建/申请 API Key (v3 auth)。
    *   **应用名称:** 可填 `Neural Cinematek` 或自定义。
    *   **应用 URL:** 填写 `http://localhost` 或你的 GitHub 仓库地址。
    *   **应用简介:** 详细说明你的用途（可参考下方模板）：
        ```text
        Personal, non-commercial movie collection manager running locally via http://localhost. Uses TMDb Search API to find movie ID/poster and Details/Credits API to fetch director/year/country/poster for locally stored movie entries. Data is for personal display only.
        ```
    *   **妥善保管你的 API Key (v3 auth)**。
3.  **运行:**
    *   直接在浏览器中打开 `movie.html` 文件。
    *   **推荐:** 使用一个简单的本地服务器（如 VS Code 的 Live Server 插件）来运行，以避免潜在的本地文件访问限制。右键点击 `wy.html` 选择 "Open with Live Server"。
4.  **配置 API Key:**
    *   页面加载后，点击右上角的 **管理 (Manage)** 按钮。
    *   选择 **设置 (Settings)**。
    *   将你获取到的 TMDb API Key 粘贴到输入框中。
    *   点击 **保存 Key (Save Key)**。

## :: 使用指南 (Usage Guide) ::

*   **浏览:** 电影列表默认按最新的打分日期排序，使用底部分页控件浏览。
*   **添加:** 点击右上角 **管理** -> **添加电影**，在弹出的模态框中填写信息（带 * 为必填），其他信息会自动尝试获取。
*   **导入:** 点击 **管理** -> **导入 CSV**，选择符合格式的 UTF-8 编码 CSV 文件导入。
*   **编辑/删除:** 每个电影卡片下方有对应的编辑和删除按钮。
*   **批量删除:** 勾选电影卡片左上角的复选框，或使用列表上方的“全选”复选框，然后点击 **管理** -> **删除选中**。 **注意：全选状态下删除会清空所有数据！**
*   **导出:** 点击 **管理** -> **导出 CSV**。
*   **查找链接:** 在添加或编辑电影时，可以利用旁边的“豆瓣”按钮快速搜索。

## :: !! 安全警告 (Security Warning) !! ::

*   此应用将你的 TMDb API Key 存储在浏览器的 Local Storage 中。这**不是一种安全的做法**，因为浏览器存储容易被访问。
*   **请仅在你的私人、受信任的计算机上运行此应用。**
*   **切勿将包含你的 API Key 的版本部署到任何公开的网络服务器或分享给他人！** 否则你的 API Key 可能被滥用。
*   如果需要更安全的方案，应考虑将 API 请求通过一个你自己的后端代理服务进行转发。

## :: 自定义 (Customization) ::

*   视觉风格主要由 `css/syberpoke.css` 控制，你可以修改 CSS 变量 (`:root` 部分) 或其他规则来调整颜色、字体、辉光等效果。

## :: 许可证 (License) ::

本项目采用 [MIT 许可证](./LICENSE)。 

## :: 维护者 (Maintainer) ::

*   [dxc/路易斯酸] ([e-mail：20223535@csuft.edu.cn QQ：2253864680])

---
> "// 保持警惕，数据永不眠。"
