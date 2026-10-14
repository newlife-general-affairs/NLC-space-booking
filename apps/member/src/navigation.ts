export type MemberTab = 'home' | 'booking' | 'weekly' | 'me' | 'issues';

export const MEMBER_TABS: MemberTab[] = ['home', 'booking', 'weekly', 'me'];

// 舊版 ?tab= 捷徑（PWA shortcut）仍可能帶 records，對應到新的「我的」分頁
export function parseTabParam(param: string | null): MemberTab {
  if (param === 'records') return 'me';
  return (MEMBER_TABS as string[]).includes(param || '') ? (param as MemberTab) : 'home';
}
