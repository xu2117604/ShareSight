"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OfficePreview from "./components/OfficePreview";
import ScheduleCalendar from "./components/ScheduleCalendar";

type User = {
  phone: string;
  name: string;
  role: "admin" | "member";
};

type SharedFile = {
  id: number;
  title: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  category: "journal" | "presentation" | "document";
  folder: string;
  notes: string;
  uploaderPhone: string;
  uploaderName: string;
  uploadedAt: string;
};

type FolderRecord = {
  id: number;
  parentId: number;
  name: string;
  createdBy: string;
  createdAt: string;
  fileCount: number;
  subfolderCount: number;
};

type TeamInfo = {
  total: number;
  members: Array<{
    name: string;
    phone: string;
    role: "admin" | "member";
  }>;
};

const categoryLabel = {
  journal: "组会日志",
  presentation: "演示文稿",
  document: "其他资料",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registerName, setRegisterName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [team, setTeam] = useState<TeamInfo>({ total: 0, members: [] });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | SharedFile["category"]>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderRecord | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderRecord[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [movingFile, setMovingFile] = useState<SharedFile | null>(null);
  const [moveFolders, setMoveFolders] = useState<FolderRecord[]>([]);
  const [moveCurrentFolder, setMoveCurrentFolder] = useState<FolderRecord | null>(null);
  const [moveBreadcrumbs, setMoveBreadcrumbs] = useState<FolderRecord[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState("");
  const [moving, setMoving] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<SharedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const response = await fetch("/api/files");
    if (response.ok) {
      const data = (await response.json()) as { files: SharedFile[] };
      setFiles(data.files);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    const response = await fetch("/api/team");
    if (response.ok) setTeam((await response.json()) as TeamInfo);
  }, []);

  const loadFolders = useCallback(async (parentId = 0) => {
    const response = await fetch(`/api/folders?parentId=${parentId}`);
    if (response.ok) {
      const data = (await response.json()) as { folders: FolderRecord[] };
      setFolders(data.folders);
    }
  }, []);

  useEffect(() => {
    fetch("/api/session")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { user: User };
        setUser(data.user);
        await Promise.all([loadFiles(), loadTeam(), loadFolders(0)]);
      })
      .finally(() => setLoading(false));
  }, [loadFiles, loadFolders, loadTeam]);

  const visibleFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return files.filter((file) => {
      const matchesFilter = filter === "all" || file.category === filter;
      const matchesFolder = file.folder === String(currentFolder?.id ?? 0);
      const matchesSearch =
        !keyword ||
        `${file.title} ${file.fileName} ${file.uploaderName} ${file.notes}`
          .toLowerCase()
          .includes(keyword);
      return matchesFilter && matchesFolder && matchesSearch;
    });
  }, [files, filter, search, currentFolder]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = (await response.json()) as { user?: User; error?: string };
    if (!response.ok || !data.user) {
      setLoginError(data.error ?? "登录失败，请检查手机号和密码");
      setLoggingIn(false);
      return;
    }
    setUser(data.user);
    setPassword("");
    await Promise.all([loadFiles(), loadTeam(), loadFolders(0)]);
    setLoggingIn(false);
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    if (password !== confirmPassword) {
      setLoginError("两次输入的密码不一致");
      return;
    }
    setLoggingIn(true);
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: registerName, phone, password }),
    });
    const data = (await response.json()) as { user?: User; error?: string };
    if (!response.ok || !data.user) {
      setLoginError(data.error ?? "注册失败，请稍后再试");
      setLoggingIn(false);
      return;
    }
    setUser(data.user);
    setPassword("");
    setConfirmPassword("");
    await Promise.all([loadFiles(), loadTeam(), loadFolders(0)]);
    setLoggingIn(false);
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setFiles([]);
    setFolders([]);
    setCurrentFolder(null);
    setBreadcrumbs([]);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setUploadError("请先选择要上传的文件");
      return;
    }
    setUploading(true);
    setUploadError("");
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams({
      title: String(form.get("title") ?? ""),
      category: String(form.get("category") ?? ""),
      notes: String(form.get("notes") ?? ""),
      fileName: selectedFile.name,
      contentType: selectedFile.type || "application/octet-stream",
      fileSize: String(selectedFile.size),
      folder: String(currentFolder?.id ?? 0),
    });
    const response = await fetch(`/api/files?${query.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: selectedFile,
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setUploadError(data.error ?? "上传失败，请稍后再试");
      setUploading(false);
      return;
    }
    setUploading(false);
    setSelectedFile(null);
    setShowUpload(false);
    await Promise.all([loadFiles(), loadFolders(currentFolder?.id ?? 0)]);
  }

  async function openFolder(folder: FolderRecord) {
    setBreadcrumbs((current) => [...current, folder]);
    setCurrentFolder(folder);
    setFilter("all");
    await loadFolders(folder.id);
  }

  async function goToFolder(index: number) {
    const nextBreadcrumbs = index < 0 ? [] : breadcrumbs.slice(0, index + 1);
    const targetFolder = index < 0 ? null : nextBreadcrumbs[index];
    setBreadcrumbs(nextBreadcrumbs);
    setCurrentFolder(targetFolder);
    setFilter("all");
    await loadFolders(targetFolder?.id ?? 0);
  }

  async function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingFolder(true);
    setFolderError("");
    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, parentId: currentFolder?.id ?? 0 }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFolderError(data.error ?? "新建文件夹失败，请稍后再试");
      setCreatingFolder(false);
      return;
    }
    setCreatingFolder(false);
    setFolderName("");
    setShowCreateFolder(false);
    await loadFolders(currentFolder?.id ?? 0);
  }

  async function handleDeleteFolder(folder: FolderRecord) {
    const contentSummary = folder.subfolderCount || folder.fileCount
      ? `里面的 ${folder.subfolderCount} 个子文件夹和 ${folder.fileCount} 份资料也会一起删除。`
      : "这个文件夹目前是空的。";
    if (!window.confirm(`确定删除文件夹“${folder.name}”吗？${contentSummary}此操作无法撤销。`)) return;
    const response = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      window.alert(data.error ?? "删除文件夹失败，请稍后再试");
      return;
    }
    await Promise.all([loadFolders(currentFolder?.id ?? 0), loadFiles()]);
  }

  async function loadMoveFolders(parentId: number) {
    setMoveLoading(true);
    setMoveError("");
    const response = await fetch(`/api/folders?parentId=${parentId}`);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMoveError(data.error ?? "读取文件夹失败");
      setMoveLoading(false);
      return;
    }
    const data = (await response.json()) as { folders: FolderRecord[] };
    setMoveFolders(data.folders);
    setMoveLoading(false);
  }

  async function openMoveDialog(file: SharedFile) {
    setMovingFile(file);
    setMoveCurrentFolder(null);
    setMoveBreadcrumbs([]);
    await loadMoveFolders(0);
  }

  async function openMoveFolder(folder: FolderRecord) {
    setMoveBreadcrumbs((current) => [...current, folder]);
    setMoveCurrentFolder(folder);
    await loadMoveFolders(folder.id);
  }

  async function goToMoveFolder(index: number) {
    const nextBreadcrumbs = index < 0 ? [] : moveBreadcrumbs.slice(0, index + 1);
    const targetFolder = index < 0 ? null : nextBreadcrumbs[index];
    setMoveBreadcrumbs(nextBreadcrumbs);
    setMoveCurrentFolder(targetFolder);
    await loadMoveFolders(targetFolder?.id ?? 0);
  }

  async function handleMoveFile() {
    if (!movingFile) return;
    setMoving(true);
    setMoveError("");
    const folderId = moveCurrentFolder?.id ?? 0;
    const response = await fetch(`/api/files/${movingFile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMoveError(data.error ?? "移动资料失败，请稍后再试");
      setMoving(false);
      return;
    }
    setMoving(false);
    setMovingFile(null);
    await Promise.all([loadFiles(), loadFolders(currentFolder?.id ?? 0)]);
  }

  async function handleDelete(file: SharedFile) {
    if (!window.confirm(`确定删除“${file.title}”吗？此操作无法撤销。`)) return;
    const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    if (response.ok) setFiles((current) => current.filter((item) => item.id !== file.id));
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">S</div>
        <p>正在进入组会资料库…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-story">
          <div className="brand">
            <span className="brand-mark">S</span>
            <span>ShareSight</span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">TEAM KNOWLEDGE HUB</p>
            <h1>让每一次分享，<br />都有迹可循。</h1>
            <p className="story-intro">
              统一保存组会日志、汇报 PPT 和研究资料。成员轻松上传，管理员集中维护。
            </p>
          </div>
          <div className="forest-scene" aria-hidden="true">
            <img src="/forest-musk-deer-silhouette.png" alt="" />
          </div>
          <div className="feature-row">
            <span>01&nbsp; 资料集中归档</span>
            <span>02&nbsp; 权限清晰可控</span>
            <span>03&nbsp; 随时查找下载</span>
          </div>
        </section>

        <section className="login-panel">
          <form className="login-card" onSubmit={authMode === "login" ? handleLogin : handleRegister}>
            <div className="mobile-brand">
              <span className="brand-mark">S</span>
              <span>ShareSight</span>
            </div>
            <p className="eyebrow">WELCOME BACK</p>
            <h2>{authMode === "login" ? "登录资料库" : "创建新账号"}</h2>
            <p className="muted">
              {authMode === "login" ? "使用已登记的手机号与密码继续" : "首次使用，请先登记组员信息"}
            </p>

            {authMode === "register" && (
              <label>
                姓名
                <input
                  autoComplete="name"
                  placeholder="请输入真实姓名"
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value.slice(0, 20))}
                  required
                />
              </label>
            )}
            <label>
              手机号码
              <div className="phone-input">
                <span>+86</span>
                <input
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
                  required
                />
              </div>
            </label>
            <label>
              登录密码
              <input
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {authMode === "register" && (
              <label>
                确认密码
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>
            )}
            {loginError && <p className="form-error">{loginError}</p>}
            <button className="primary-button" disabled={loggingIn}>
              {loggingIn ? "正在处理…" : authMode === "login" ? "登录" : "注册并进入"}
            </button>
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setLoginError("");
                setPassword("");
                setConfirmPassword("");
              }}
            >
              {authMode === "login" ? "第一次使用？立即注册 →" : "已有账号？返回登录 →"}
            </button>

            {authMode === "login" && <div className="demo-accounts">
              <strong>初版体验账号</strong>
              <p>管理员：13800000001 / Admin123!</p>
              <p>普通成员：13900000000 / Member123!</p>
            </div>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>ShareSight</span>
        </div>
        <nav aria-label="主要导航">
          <button className="nav-item active"><span>⌂</span>资料库</button>
          <button className="nav-item" onClick={() => setShowUpload(true)}><span>＋</span>上传资料</button>
        </nav>
        <section className="team-card">
          <div className="team-card-heading">
            <span>小组成员</span>
            <strong>{team.total} 人</strong>
          </div>
          <div className="member-avatars" aria-label={`小组共有 ${team.total} 人`}>
            {team.members.slice(0, 4).map((member, index) => (
              <span key={`${member.phone}-${index}`} title={`${member.name} · ${member.role === "admin" ? "管理员" : "组员"}`}>
                {member.name.slice(0, 1)}
              </span>
            ))}
            {team.total > 4 && <span>+{team.total - 4}</span>}
          </div>
          <p>{team.members.slice(0, 3).map((member) => member.name).join("、")}{team.total > 3 ? " 等" : ""}</p>
        </section>
        <div className="sidebar-note">
          <span className="note-dot" />
          <p><strong>资料安全保存</strong><br />仅登录成员可访问</p>
        </div>
        <div className="account-row">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role === "admin" ? "管理员" : "普通成员"}</span>
          </div>
          <button aria-label="退出登录" title="退出登录" onClick={handleLogout}>↗</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">KNOWLEDGE LIBRARY</p>
            <h1>组会资料库</h1>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <span>⌕</span>
              <input
                aria-label="搜索资料"
                placeholder="搜索标题、文件或上传者"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <button className="primary-button compact" onClick={() => setShowUpload(true)}>
              <span>＋</span> 上传资料
            </button>
          </div>
        </header>

        <ScheduleCalendar />

        <section className="stats-grid">
          <article className="stat-card main-stat">
            <div>
              <p>资料总数</p>
              <strong>{files.length}</strong>
            </div>
            <span className="stat-trend">持续沉淀中</span>
          </article>
          <article className="stat-card">
            <span className="file-symbol presentation">P</span>
            <div><p>演示文稿</p><strong>{files.filter((item) => item.category === "presentation").length}</strong></div>
          </article>
          <article className="stat-card">
            <span className="file-symbol journal">记</span>
            <div><p>组会日志</p><strong>{files.filter((item) => item.category === "journal").length}</strong></div>
          </article>
        </section>

        <section className="library-panel">
          <div className="panel-heading">
            <div>
              <div className="breadcrumbs" aria-label="当前文件夹位置">
                <button onClick={() => goToFolder(-1)}>团队文档</button>
                {breadcrumbs.map((folder, index) => (
                  <span key={folder.id}>
                    <i>/</i>
                    <button onClick={() => goToFolder(index)}>{folder.name}</button>
                  </span>
                ))}
              </div>
              <h2>{currentFolder?.name ?? "团队文档"}</h2>
              <p>可以在当前位置新建文件夹，或直接上传资料</p>
            </div>
            <div className="panel-actions">
              <button className="new-folder-button" onClick={() => {
                setFolderError("");
                setShowCreateFolder(true);
              }}>＋ 新建文件夹</button>
              <div className="filters">
                {(["all", "journal", "presentation", "document"] as const).map((value) => (
                  <button
                    key={value}
                    className={filter === value ? "active" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all" ? "全部" : categoryLabel[value]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {folders.length > 0 && !search.trim() && (
            <div className="folder-list">
              <div className="folder-list-header" aria-hidden="true">
                <span>名称</span>
                <span>创建者</span>
                <span>建立时间</span>
                <span>内容</span>
                <span />
                <span>操作</span>
              </div>
              <div className="folder-grid">
                {folders.map((folder) => (
                  <article className="folder-card" key={folder.id}>
                    <button className="folder-open-button" onClick={() => openFolder(folder)}>
                      <span className="folder-name-cell">
                        <span className="folder-icon"><i>{folder.name.slice(0, 1)}</i></span>
                        <span className="folder-details"><strong>{folder.name}</strong></span>
                      </span>
                      <span className="folder-owner">{folder.createdBy}</span>
                      <span className="folder-date">{formatDate(folder.createdAt)}</span>
                      <span className="folder-count">{folder.subfolderCount} 个文件夹 · {folder.fileCount} 份资料</span>
                      <span className="folder-arrow">→</span>
                    </button>
                    {user.role === "admin" && (
                      <button
                        className="folder-delete-button"
                        title={`删除文件夹 ${folder.name}`}
                        aria-label={`删除文件夹 ${folder.name}`}
                        onClick={() => handleDeleteFolder(folder)}
                      >
                        ×
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
          {visibleFiles.length === 0 && (folders.length === 0 || search.trim()) ? (
            <div className="empty-state">
              <div className="empty-illustration"><span>＋</span></div>
              <h3>{search.trim() || filter !== "all" ? "没有找到匹配的资料" : "当前目录还是空的"}</h3>
              <p>{search.trim() || filter !== "all" ? "试试更换关键词或筛选条件" : "可以先新建文件夹，也可以直接上传资料"}</p>
              {!search.trim() && filter === "all" && (
                <div className="empty-actions">
                  <button className="text-button" onClick={() => setShowCreateFolder(true)}>新建文件夹 →</button>
                  <button className="text-button" onClick={() => setShowUpload(true)}>上传资料 →</button>
                </div>
              )}
            </div>
          ) : visibleFiles.length > 0 ? (
            <div className="file-list">
              {visibleFiles.map((file) => (
                <article className="file-row" key={file.id}>
                  <span className={`file-symbol ${file.category}`}>
                    {file.category === "presentation" ? "P" : file.category === "journal" ? "记" : "文"}
                  </span>
                  <div className="file-main">
                    <div className="file-title-line">
                      <h3>{file.title}</h3>
                      <span className="category-pill">{categoryLabel[file.category]}</span>
                    </div>
                    <p>{file.fileName} · {formatSize(file.fileSize)}</p>
                  </div>
                  <div className="file-meta">
                    <span>{file.uploaderName}</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                  <div className="file-actions">
                    {(user.role === "admin" || user.phone === file.uploaderPhone) && (
                      <button title="移动资料" aria-label={`移动 ${file.title}`} onClick={() => openMoveDialog(file)}>移</button>
                    )}
                    <button title="预览资料" aria-label={`预览 ${file.title}`} onClick={() => setPreviewingFile(file)}>览</button>
                    <a href={`/api/files/${file.id}/download`} title="下载文件" aria-label={`下载 ${file.title}`}>↓</a>
                    {user.role === "admin" && (
                      <button className="delete-action" title="删除文件" aria-label={`删除 ${file.title}`} onClick={() => handleDelete(file)}>×</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>

      {showUpload && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowUpload(false);
        }}>
          <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
            <div className="modal-heading">
              <div><p className="eyebrow">NEW RESOURCE</p><h2 id="upload-title">上传资料</h2></div>
              <button aria-label="关闭上传窗口" onClick={() => setShowUpload(false)}>×</button>
            </div>
            <form onSubmit={handleUpload}>
              <div
                className={`dropzone ${dragging ? "dragging" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  setSelectedFile(event.dataTransfer.files[0] ?? null);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept=".ppt,.pptx,.pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.csv,.zip,.db,.sqlite"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <span className="upload-icon">↑</span>
                <strong>{selectedFile ? selectedFile.name : "拖放文件到这里，或点击选择"}</strong>
                <p>{selectedFile ? formatSize(selectedFile.size) : "支持 PPT、PDF、Word、表格、数据文件等，最大 80MB"}</p>
              </div>
              <div className="form-grid">
                <label>
                  资料标题
                  <input name="title" placeholder="例如：7 月第二周组会汇报" required />
                </label>
                <label>
                  资料类型
                  <select name="category" defaultValue="presentation">
                    <option value="presentation">演示文稿</option>
                    <option value="journal">组会日志</option>
                    <option value="document">其他资料</option>
                  </select>
                </label>
              </div>
              <div className="destination-note">
                <span>保存位置</span>
                <strong>团队文档{breadcrumbs.map((folder) => ` / ${folder.name}`).join("")}</strong>
              </div>
              <label>
                备注（选填）
                <textarea name="notes" placeholder="简单说明这份资料的内容…" rows={3} />
              </label>
              {uploadError && <p className="form-error">{uploadError}</p>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowUpload(false)}>取消</button>
                <button className="primary-button compact" disabled={uploading}>{uploading ? "正在上传…" : "确认上传"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showCreateFolder && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCreateFolder(false);
        }}>
          <section className="create-folder-modal" role="dialog" aria-modal="true" aria-labelledby="folder-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">NEW FOLDER</p>
                <h2 id="folder-title">新建文件夹</h2>
                <p className="preview-subtitle">
                  位置：团队文档{breadcrumbs.map((folder) => ` / ${folder.name}`).join("")}
                </p>
              </div>
              <button aria-label="关闭新建文件夹窗口" onClick={() => setShowCreateFolder(false)}>×</button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <label>
                文件夹名称
                <input
                  autoFocus
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value.slice(0, 50))}
                  placeholder="例如：本周组会资料"
                  required
                />
              </label>
              {folderError && <p className="form-error">{folderError}</p>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowCreateFolder(false)}>取消</button>
                <button className="primary-button compact" disabled={creatingFolder}>
                  {creatingFolder ? "正在建立…" : "建立文件夹"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {movingFile && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMovingFile(null);
        }}>
          <section className="move-modal" role="dialog" aria-modal="true" aria-labelledby="move-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">MOVE RESOURCE</p>
                <h2 id="move-title">移动资料</h2>
                <p className="preview-subtitle">{movingFile.title} · {movingFile.fileName}</p>
              </div>
              <button aria-label="关闭移动窗口" onClick={() => setMovingFile(null)}>×</button>
            </div>
            <div className="move-location">
              <span>目标位置</span>
              <div className="move-breadcrumbs">
                <button onClick={() => goToMoveFolder(-1)}>团队文档</button>
                {moveBreadcrumbs.map((folder, index) => (
                  <span key={folder.id}>
                    <i>/</i>
                    <button onClick={() => goToMoveFolder(index)}>{folder.name}</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="move-folder-list">
              {moveLoading ? (
                <p className="move-empty">正在读取文件夹…</p>
              ) : moveFolders.length ? (
                moveFolders.map((folder) => (
                  <button key={folder.id} onClick={() => openMoveFolder(folder)}>
                    <span className="folder-icon"><i>{folder.name.slice(0, 1)}</i></span>
                    <span><strong>{folder.name}</strong><small>{folder.subfolderCount} 个子文件夹</small></span>
                    <i>→</i>
                  </button>
                ))
              ) : (
                <p className="move-empty">这个位置没有子文件夹</p>
              )}
            </div>
            {moveError && <p className="form-error">{moveError}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setMovingFile(null)}>取消</button>
              <button
                className="primary-button compact"
                disabled={moving || movingFile.folder === String(moveCurrentFolder?.id ?? 0)}
                onClick={handleMoveFile}
              >
                {moving
                  ? "正在移动…"
                  : movingFile.folder === String(moveCurrentFolder?.id ?? 0)
                    ? "资料已在这里"
                    : "移动到这里"}
              </button>
            </div>
          </section>
        </div>
      )}

      {previewingFile && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPreviewingFile(null);
        }}>
          <section className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">RESOURCE PREVIEW</p>
                <h2 id="preview-title">{previewingFile.title}</h2>
                <p className="preview-subtitle">{previewingFile.fileName} · {formatSize(previewingFile.fileSize)}</p>
              </div>
              <button aria-label="关闭预览" onClick={() => setPreviewingFile(null)}>×</button>
            </div>
            {/\.(pdf|txt|md)$/i.test(previewingFile.fileName) ? (
              <iframe
                className="document-preview"
                src={`/api/files/${previewingFile.id}/preview`}
                title={`${previewingFile.title} 文件预览`}
              />
            ) : /\.(pptx|docx|xlsx)$/i.test(previewingFile.fileName) ? (
              <OfficePreview fileId={previewingFile.id} fileName={previewingFile.fileName} />
            ) : (
              <div className="preview-placeholder">
                <span className={`file-symbol ${previewingFile.category}`}>
                  {previewingFile.category === "presentation" ? "P" : previewingFile.category === "journal" ? "记" : "文"}
                </span>
                <h3>这个旧版格式暂时无法直接预览</h3>
                <p>{previewingFile.notes || "请将文件另存为 PPTX、DOCX 或 XLSX 后重新上传，即可在网页中查看内容。"}</p>
              </div>
            )}
            <div className="preview-footer">
              <div>
                <span>{categoryLabel[previewingFile.category]}</span>
                <span>{previewingFile.uploaderName} 上传</span>
              </div>
              <a className="primary-button compact" href={`/api/files/${previewingFile.id}/download`}>下载原文件 ↓</a>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
