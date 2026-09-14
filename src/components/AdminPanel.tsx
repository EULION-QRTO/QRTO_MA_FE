import { useEffect, useState } from "react";
import {
  MenuItem,
  MenuCategory,
  MENU_CATEGORIES,
  DEFAULT_MENU_CATEGORY,
  SettlementAccount,
} from "@/lib/types";
import SalesSummaryCard from "@/components/SalesSummaryCard";

/** 주점 기본·최소 테이블 개수 32. 설정값이 없거나 더 작으면 32로 맞춘다. */
const MIN_TABLES = 32;
const MAX_TABLES = 100;

/** 메뉴 사진 허용 형식·용량 (POST /api/pos/menus/{id}/image 명세) */
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  tableCount: number;
  onTableCountChange: (count: number) => void;
  menu: MenuItem[];
  onAddMenu: (name: string, price: number, category: MenuCategory, imageFile?: File) => void;
  onUpdateMenu: (id: string, patch: Partial<Omit<MenuItem, "id" | "image" | "soldOut">>) => void;
  /** 품절 토글 */
  onToggleSoldOut: (id: string, soldOut: boolean) => void;
  /** 메뉴 사진 업로드/삭제. file=null 이면 삭제. */
  onSetMenuImage: (id: string, file: File | null) => void;
  onDeleteMenu: (id: string) => void;
  account: SettlementAccount;
  onSaveAccount: (account: SettlementAccount) => void;
}

/** 허용 형식·용량 검사. 통과 못하면 안내 메시지 반환. */
function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "JPEG·PNG·WebP 파일만 업로드할 수 있습니다.";
  if (file.size > IMAGE_MAX_BYTES) return "5MB 이하 사진만 업로드할 수 있습니다.";
  return null;
}

function ImagePicker({
  value,
  onPick,
  onClear,
  label,
}: {
  value?: string;
  onPick: (file: File) => void;
  onClear?: () => void;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File) => {
    const err = validateImage(file);
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3000);
      return;
    }
    onPick(file);
  };

  return (
    <div className="thumb-wrap">
      <label className="thumb" title={error ?? label} aria-label={label}>
        {value ? (
          <img src={value} alt="" className="thumb__img" />
        ) : (
          <span className="thumb__ph">📷</span>
        )}
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          className="thumb__input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pick(file);
            e.target.value = "";
          }}
        />
      </label>
      {value && onClear && (
        <button type="button" className="thumb__clear" onClick={onClear} aria-label="사진 제거">
          ✕
        </button>
      )}
      {error && <p className="thumb__error">{error}</p>}
    </div>
  );
}

export default function AdminPanel({
  tableCount,
  onTableCountChange,
  menu,
  onAddMenu,
  onUpdateMenu,
  onToggleSoldOut,
  onSetMenuImage,
  onDeleteMenu,
  account,
  onSaveAccount,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState<MenuCategory>(DEFAULT_MENU_CATEGORY);
  const [newImageFile, setNewImageFile] = useState<File | undefined>(undefined);
  const [newImagePreview, setNewImagePreview] = useState<string | undefined>(undefined);

  // 새 메뉴 사진 선택: 로컬 미리보기(objectURL) 생성 후 파일 보관 (실제 업로드는 메뉴 생성 후)
  const pickNewImage = (file: File) => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  };
  const clearNewImage = () => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(undefined);
    setNewImagePreview(undefined);
  };

  // 정산 계좌 편집 초안 (저장 시 커밋)
  const [acctDraft, setAcctDraft] = useState<SettlementAccount>(account);
  const [acctSaved, setAcctSaved] = useState(false);
  const acctDirty =
    acctDraft.bank !== account.bank ||
    acctDraft.number !== account.number ||
    acctDraft.holder !== account.holder;
  const acctValid =
    acctDraft.bank.trim() !== "" &&
    acctDraft.number.trim() !== "" &&
    acctDraft.holder.trim() !== "";

  const saveAccount = () => {
    if (!acctValid || !acctDirty) return;
    onSaveAccount({
      bank: acctDraft.bank.trim(),
      number: acctDraft.number.trim(),
      holder: acctDraft.holder.trim(),
    });
    setAcctSaved(true);
    setTimeout(() => setAcctSaved(false), 2000);
  };

  const clamp = (n: number) =>
    Number.isFinite(n) ? Math.min(MAX_TABLES, Math.max(MIN_TABLES, n)) : MIN_TABLES;

  // 테이블 스텝퍼: 로컬에서 자유롭게 조절하고 저장 시에만 서버 반영(bulk).
  const [localTableCount, setLocalTableCount] = useState(() => clamp(tableCount));
  const [tableSaved, setTableSaved] = useState(false);
  const tableDirty = localTableCount !== clamp(tableCount);

  useEffect(() => {
    setLocalTableCount(clamp(tableCount));
  }, [tableCount]);

  const saveTableCount = () => {
    if (!tableDirty) return;
    onTableCountChange(localTableCount);
    setTableSaved(true);
    setTimeout(() => setTableSaved(false), 2000);
  };

  const submitNew = () => {
    const name = newName.trim();
    const price = parseInt(newPrice, 10);
    if (!name || Number.isNaN(price) || price < 0) return;
    onAddMenu(name, price, newCategory, newImageFile);
    setNewName("");
    setNewPrice("");
    clearNewImage();
    setNewCategory(DEFAULT_MENU_CATEGORY);
  };

  return (
    <div className="admin">
      {/* ── 매출 요약 (날짜 조회 · CSV/XLSX 내보내기) ── */}
      <SalesSummaryCard />

      {/* ── 테이블 설정 ── */}
      <section className="admin-card">
        <h2 className="admin-card__title">테이블 설정</h2>
        <div className="admin-setting">
          <span className="admin-setting__label">테이블 개수</span>
          <div className="stepper">
            <button
              className="stepper__btn"
              onClick={() => setLocalTableCount(clamp(localTableCount - 1))}
              disabled={localTableCount <= MIN_TABLES}
              aria-label="테이블 개수 감소"
            >
              −
            </button>
            <span className="stepper__value">{localTableCount}</span>
            <button
              className="stepper__btn"
              onClick={() => setLocalTableCount(clamp(localTableCount + 1))}
              disabled={localTableCount >= MAX_TABLES}
              aria-label="테이블 개수 증가"
            >
              +
            </button>
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={saveTableCount}
            disabled={!tableDirty}
          >
            저장
          </button>
          <span className="admin-setting__hint">
            {tableSaved
              ? "✓ 저장되었습니다"
              : "저장을 눌러야 서버와 POS 화면에 반영됩니다. 개수를 줄이면 뒷번호 테이블의 진행중 주문도 함께 삭제됩니다. (32~100)"}
          </span>
        </div>
      </section>

      {/* ── 정산 계좌 ── */}
      <section className="admin-card">
        <h2 className="admin-card__title">정산 계좌</h2>
        <p className="admin-card__desc">
          주문 후 고객이 송금할 계좌입니다. 고객 주문 화면의 송금 안내에 연결됩니다.
        </p>
        <div className="account-form">
          <label className="account-field">
            <span className="account-field__label">은행</span>
            <input
              className="field"
              placeholder="예: 국민은행"
              value={acctDraft.bank}
              onChange={(e) => setAcctDraft((d) => ({ ...d, bank: e.target.value }))}
            />
          </label>
          <label className="account-field">
            <span className="account-field__label">계좌번호</span>
            <input
              className="field"
              inputMode="numeric"
              placeholder="'-' 없이 숫자만"
              value={acctDraft.number}
              onChange={(e) =>
                setAcctDraft((d) => ({ ...d, number: e.target.value.replace(/[^0-9-]/g, "") }))
              }
            />
          </label>
          <label className="account-field">
            <span className="account-field__label">예금주</span>
            <input
              className="field"
              placeholder="예금주명"
              value={acctDraft.holder}
              onChange={(e) => setAcctDraft((d) => ({ ...d, holder: e.target.value }))}
            />
          </label>
        </div>
        <div className="account-form__foot">
          <span className="account-form__status">
            {acctSaved
              ? "✓ 저장되었습니다"
              : account.number
                ? `현재: ${account.bank} ${account.number} (${account.holder})`
                : "등록된 계좌가 없습니다"}
          </span>
          <button
            className="btn btn--primary btn--sm"
            onClick={saveAccount}
            disabled={!acctValid || !acctDirty}
          >
            저장
          </button>
        </div>
      </section>

      {/* ── 메뉴 관리 ── */}
      <section className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">메뉴 관리</h2>
          <span className="admin-card__count">{menu.length}개</span>
        </div>

        <div className="menu-add">
          <ImagePicker
            value={newImagePreview}
            onPick={pickNewImage}
            onClear={clearNewImage}
            label="메뉴 사진 첨부 (선택)"
          />
          <select
            className="field field--select"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as MenuCategory)}
            aria-label="카테고리"
          >
            {MENU_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="field field--grow"
            placeholder="메뉴명"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
          />
          <input
            className="field field--price"
            type="number"
            min={0}
            placeholder="가격"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
          />
          <button className="btn btn--primary btn--sm" onClick={submitNew}>
            추가
          </button>
        </div>

        <ul className="menu-list">
          {menu.length === 0 && <li className="menu-list__empty">등록된 메뉴가 없습니다</li>}
          {menu.map((item) => (
            <li className={`menu-row${item.soldOut ? " menu-row--soldout" : ""}`} key={item.id}>
              <ImagePicker
                value={item.image}
                onPick={(file) => onSetMenuImage(item.id, file)}
                onClear={() => onSetMenuImage(item.id, null)}
                label={`${item.name} 사진`}
              />
              <select
                className="field field--select"
                value={item.category}
                onChange={(e) =>
                  onUpdateMenu(item.id, { category: e.target.value as MenuCategory })
                }
                aria-label={`${item.name} 카테고리`}
              >
                {MENU_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="field field--grow"
                value={item.name}
                onChange={(e) => onUpdateMenu(item.id, { name: e.target.value })}
                aria-label="메뉴명"
              />
              <div className="field field--price-wrap">
                <input
                  className="field field--price"
                  type="number"
                  min={0}
                  value={item.price}
                  onChange={(e) => onUpdateMenu(item.id, { price: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  aria-label="가격"
                />
                <span className="field__suffix">원</span>
              </div>
              <button
                type="button"
                className={`btn btn--sm${item.soldOut ? " btn--primary" : " btn--secondary"}`}
                onClick={() => onToggleSoldOut(item.id, !item.soldOut)}
                aria-pressed={item.soldOut}
                title="품절 상태 전환"
              >
                {item.soldOut ? "품절" : "판매중"}
              </button>
              <button
                className="menu-row__del"
                onClick={() => onDeleteMenu(item.id)}
                aria-label={`${item.name} 삭제`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
