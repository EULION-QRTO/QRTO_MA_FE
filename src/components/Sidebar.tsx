import { useState, type ReactNode } from "react";
import { WaitingOrder, WaitStage } from "@/lib/types";
import WaitingOrderCard from "./WaitingOrderCard";
import { IconDot, IconBox } from "@/components/icons";

interface Props {
  orders: WaitingOrder[];
  now: number;
  onSetStage: (id: string, stage: WaitStage) => void;
  onCancel: (id: string) => void;
}

function Section({
  icon,
  title,
  orders,
  now,
  onSetStage,
  onCancel,
  hidden,
}: {
  icon: ReactNode;
  title: string;
  orders: WaitingOrder[];
  now: number;
  onSetStage: (id: string, stage: WaitStage) => void;
  onCancel: (id: string) => void;
  hidden?: boolean;
}) {
  return (
    <section className={`side-section${hidden ? " side-section--hidden" : ""}`}>
      <div className="side-section__head">
        <span className="side-section__icon">{icon}</span>
        <h2 className="side-section__title">{title}</h2>
        <span
          className={`side-section__count${orders.length === 0 ? " side-section__count--zero" : ""}`}
        >
          {orders.length}
        </span>
      </div>
      <div className="side-section__list">
        {orders.length === 0 ? (
          <p className="side-section__empty">대기 중인 주문이 없습니다</p>
        ) : (
          orders.map((o) => (
            <WaitingOrderCard
              key={o.id}
              order={o}
              now={now}
              onSetStage={onSetStage}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function Sidebar({ orders, now, onSetStage, onCancel }: Props) {
  const [mobileTab, setMobileTab] = useState<"dine-in" | "takeout">("dine-in");
  const dineIn = orders.filter((o) => o.type === "dine-in");
  const takeout = orders.filter((o) => o.type === "takeout");

  return (
    <aside className="sidebar">
      {/* <768px 에서만 노출되는 세그먼트 탭 (DESIGN.md §5) */}
      <div className="side-switch" role="tablist">
        <button
          role="tab"
          aria-selected={mobileTab === "dine-in"}
          className={`side-switch__tab${mobileTab === "dine-in" ? " side-switch__tab--active" : ""}`}
          onClick={() => setMobileTab("dine-in")}
        >
          <IconDot className="dot dot--dinein" /> 현장 ({dineIn.length})
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === "takeout"}
          className={`side-switch__tab${mobileTab === "takeout" ? " side-switch__tab--active" : ""}`}
          onClick={() => setMobileTab("takeout")}
        >
          <IconBox /> 포장 ({takeout.length})
        </button>
      </div>

      <Section
        icon={<IconDot className="dot dot--dinein" />}
        title="현장 주문 대기"
        orders={dineIn}
        now={now}
        onSetStage={onSetStage}
        onCancel={onCancel}
        hidden={mobileTab !== "dine-in"}
      />
      <Section
        icon={<IconBox />}
        title="포장 주문 대기"
        orders={takeout}
        now={now}
        onSetStage={onSetStage}
        onCancel={onCancel}
        hidden={mobileTab !== "takeout"}
      />
    </aside>
  );
}
