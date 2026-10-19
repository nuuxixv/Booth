// 합배송(껍데기 부모 + 자식) 공유 헬퍼.
// 목록·모달·고객·출고 화면이 종합 상태·이름 요약·트리 구성을 동일 규칙으로 쓴다.
// 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

const STAGE_ORDER = { pending: 0, paid: 1, completed: 2 };
const INACTIVE = ['cancelled', 'refunded'];

/**
 * 자식 주문들의 종합 상태를 파생한다.
 * - 활성 자식(취소/환불 제외) 전부 동일 → 그 상태 (caption 없음)
 * - 섞이면 가장 뒤처진 단계(pending<paid<completed) + "일부 {앞선상태}" caption
 * - 취소 병존 → "일부 취소" caption 추가
 * - 전원 취소 → { value:'cancelled', caption:'전체 취소' }
 * @param {Array<{status:string}>} children
 * @returns {{ value:string, caption:(string|null) }}
 */
export const summarizeGroupStatus = (children = []) => {
  const active = children.filter((c) => !INACTIVE.includes(c.status));
  const cancelledCount = children.length - active.length;

  if (active.length === 0) {
    return { value: 'cancelled', caption: '전체 취소' };
  }

  const statuses = active.map((c) => c.status);
  const allSame = statuses.every((s) => s === statuses[0]);

  let laggard = statuses[0];
  let leader = statuses[0];
  statuses.forEach((s) => {
    if ((STAGE_ORDER[s] ?? 0) < (STAGE_ORDER[laggard] ?? 0)) laggard = s;
    if ((STAGE_ORDER[s] ?? 0) > (STAGE_ORDER[leader] ?? 0)) leader = s;
  });

  const captions = [];
  if (!allSame) captions.push(`일부 ${STATUS_TO_KOREAN[leader] || leader}`);
  if (cancelledCount > 0) captions.push('일부 취소');

  return {
    value: allSame ? statuses[0] : laggard,
    caption: captions.length ? captions.join(' · ') : null,
  };
};

/**
 * 자식 이름들을 유니크하게 요약한다.
 * 1명 → "A" / 2명 → "A, B" / 3명+ → "A 외 N명"
 * @param {Array<{customer_name:string}>} children
 * @returns {string}
 */
export const formatGroupCustomerNames = (children = []) => {
  const names = [...new Set(children.map((c) => c.customer_name).filter(Boolean))];
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]} 외 ${names.length - 1}명`;
};

/**
 * 합배송 자식 상태 변경 시 대표 배송지 위임 방식을 분기한다 (목록·모달 공유 단일 소스).
 * - passthrough: 일반 상태 변경 (취소/환불 아님 · 대표 아님 · 남은 활성 형제 0건 중 하나)
 * - auto: 대표 취소·환불 && 남은 활성 형제 정확히 1건 → 그 1건에 배송지 자동 위임
 * - pick: 대표 취소·환불 && 남은 활성 형제 2건+ → 배송지 받을 주문 선택 필요
 * 활성 = status가 cancelled/refunded 아님.
 * @param {{children:Array, repChildId:(number|null), child:{id:number}, newStatus:string}}
 * @returns {{ mode:'passthrough'|'auto'|'pick', siblings:Array }}
 */
export const classifyGroupStatusChange = ({ children = [], repChildId, child, newStatus }) => {
  const isCancel = INACTIVE.includes(newStatus);
  const isRep = repChildId != null && child.id === repChildId;
  const siblings = children.filter((c) => c.id !== child.id && !INACTIVE.includes(c.status));

  if (!isCancel || !isRep || siblings.length === 0) {
    return { mode: 'passthrough', siblings: [] };
  }
  if (siblings.length === 1) {
    return { mode: 'auto', siblings };
  }
  return { mode: 'pick', siblings };
};

/**
 * 합배송 그룹 소속 주문인지 판정한다.
 * - 껍데기 부모(is_group_parent) 또는 자식(parent_order_id 보유, 대표 포함) 전부.
 * 일괄 상태 변경은 대표 배송지 위임 경로(classifyGroupStatusChange)를 우회하므로
 * 그룹 소속은 선택·일괄 대상에서 전부 배제한다.
 * @param {{is_group_parent?:boolean, parent_order_id?:(number|null)}} order
 * @returns {boolean}
 */
export const isGroupMemberOrder = (order) =>
  Boolean(order?.is_group_parent) || order?.parent_order_id != null;

/**
 * 일괄 선택(전체 선택) 대상 id — 합배송 그룹 소속·준비중을 뺀 단독 실 주문만.
 * preparing(현장 도움·준비중)은 미완료 주문이라 일괄 상태 변경 대상에서 배제한다
 * (결제대기 전환은 고객 제출·상품 저장으로 자동 발생 — 일괄 변경으로 건드리지 않음).
 * @param {Array} orders 현재 페이지 주문(플랫)
 * @returns {number[]}
 */
export const selectableOrderIds = (orders = []) =>
  orders
    .filter((o) => !isGroupMemberOrder(o) && o.status !== 'preparing')
    .map((o) => o.id);

/**
 * 일괄 상태 변경 실행 직전, 선택 목록에서 합배송 그룹 소속을 걸러낸다 (최종 가드).
 * @param {Array} orders 현재 페이지 주문(플랫)
 * @param {Array<number>} selectedIds 선택된 주문 id
 * @returns {{ allowedIds:number[], excludedIds:number[] }} 실행 대상 / 그룹 소속으로 제외된 id
 */
export const partitionBulkSelectable = (orders = [], selectedIds = []) => {
  const groupMemberIds = new Set(orders.filter(isGroupMemberOrder).map((o) => o.id));
  const allowedIds = [];
  const excludedIds = [];
  selectedIds.forEach((id) => {
    (groupMemberIds.has(id) ? excludedIds : allowedIds).push(id);
  });
  return { allowedIds, excludedIds };
};

/**
 * groupLinkedOrders 결과(플랫)를 트리 구조로 변환한다.
 * 껍데기 부모 → { type:'group', shell, children } / 그 외 → { type:'single', order }
 * 부모가 현재 페이지에 없는 고아 자식은 single 로 폴백(사라짐 방지).
 * @param {Array} groupedOrders groupLinkedOrders 결과
 * @returns {Array<{type:'group'|'single', shell?, children?, order?}>}
 */
export const buildOrderTree = (groupedOrders = []) => {
  const shellIds = new Set(
    groupedOrders.filter((o) => o.is_group_parent).map((o) => o.id)
  );

  const tree = [];
  groupedOrders.forEach((order) => {
    if (order.is_group_parent) {
      tree.push({ type: 'group', shell: order, children: order.linkedChildren || [] });
    } else if (!order.parent_order_id || !shellIds.has(order.parent_order_id)) {
      // 비연계 단독 or 부모가 현재 페이지에 없는 고아 자식
      tree.push({ type: 'single', order });
    }
    // 부모가 페이지에 있는 자식은 group 노드 안에서 렌더 — top-level 스킵
  });
  return tree;
};
