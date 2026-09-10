import { useState } from "react";
import { createStore } from "@/lib/storeRegistry";
import { useStores } from "@/pages/operator/stores";

/**
 * 매장 등록 — POST /api/admin/stores.
 * 운영자가 주점 로그인 자격증명을 사전 설정한다. 등록되면 '매장 리스트'·'개요'·'QR 인쇄'에 즉시 반영.
 */
export default function StoreRegisterTab() {
  const { stores, refresh } = useStores();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [takeoutEnabled, setTakeoutEnabled] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const pwMismatch = password2 !== "" && password !== password2;
  const valid =
    name.trim() !== "" &&
    username.trim() !== "" &&
    password.length >= 8 &&
    password === password2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setResult(null);
    const res = await createStore({
      name: name.trim(),
      org: org.trim() || undefined,
      takeoutEnabled,
      username: username.trim(),
      password,
    });
    if (res.syncedToServer && res.store) {
      setResult({
        ok: true,
        msg: `등록되었습니다 (매장 #${res.store.id}, 아이디 ${username.trim()}).`,
      });
      setName("");
      setOrg("");
      setTakeoutEnabled(true);
      setUsername("");
      setPassword("");
      setPassword2("");
      void refresh();
    } else {
      setResult({
        ok: false,
        msg: `서버 등록 실패: ${res.error ?? "알 수 없는 오류"}`,
      });
    }
    setBusy(false);
  };

  return (
    <>
      <div className="op__section-head">
        <h2 className="op__section-title">매장 등록</h2>
      </div>

      <div className="op__notice op__notice--pending">
        ⓘ 운영자가 주점 <strong>로그인 아이디·비밀번호(8자 이상)를 사전 설정</strong>합니다.
        <code>POST /api/admin/stores</code> 로 서버에 매장·계정이 생성되며, 비밀번호는 전송 후
        <strong> 로컬에 저장하지 않습니다</strong>. 운영단체는 서버에 필드가 생기기 전까지 로컬 메타로 보관됩니다.
      </div>

      <form className="op-form" onSubmit={submit}>
        <label className="op-form__field">
          <span className="op-form__label">주점 이름</span>
          <input
            className="field"
            placeholder="예: 을지로 포차"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="op-form__field">
          <span className="op-form__label">운영단체</span>
          <input
            className="field"
            placeholder="예: 멋쟁이사자처럼 LPAY"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          />
        </label>
        <label className="op-form__field">
          <span className="op-form__label">로그인 아이디</span>
          <input
            className="field"
            autoComplete="off"
            placeholder="주점 로그인 아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="op-form__field">
          <span className="op-form__label">비밀번호</span>
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            placeholder="8자 이상"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="op-form__field">
          <span className="op-form__label">비밀번호 확인</span>
          <input
            className={`field${pwMismatch ? " field--error" : ""}`}
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호 재입력"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
        </label>
        <label className="op-form__check">
          <input
            type="checkbox"
            checked={takeoutEnabled}
            onChange={(e) => setTakeoutEnabled(e.target.checked)}
          />
          <span>포장(TOGO) 주문 사용</span>
        </label>
        <button className="btn btn--primary" type="submit" disabled={!valid || busy}>
          {busy ? "등록 중…" : "등록"}
        </button>
        {pwMismatch && <span className="op-form__err">비밀번호가 일치하지 않습니다.</span>}
      </form>

      {result && (
        <p className={`op__result${result.ok ? " op__result--ok" : " op__result--warn"}`}>
          {result.ok ? "✓ " : "⚠️ "}
          {result.msg}
        </p>
      )}

      <div className="op__section-head op__section-head--sub">
        <h3 className="op__subtitle">등록된 매장</h3>
        <span className="op__count">{stores.length}</span>
      </div>

      {stores.length === 0 ? (
        <p className="op__empty">등록된 매장이 없습니다.</p>
      ) : (
        <div className="op__table-wrap">
          <table className="op__table">
            <thead>
              <tr>
                <th>주점 이름</th>
                <th>운영단체</th>
                <th>로그인 아이디</th>
                <th>ID</th>
                <th>포장</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.organization ?? "—"}</td>
                  <td>{s.username ?? "—"}</td>
                  <td>#{s.id}</td>
                  <td>{s.takeoutEnabled ? "사용" : "미사용"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
