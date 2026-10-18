import { MAX_DECIMALS } from './calculatorState.ts';
import type { Action, CalcState, DecimalSep, Settings, Theme } from './calculatorState.ts';

export default function SettingsView({ state, dispatch, saveOk, onShowIntro }: {
  state: CalcState; dispatch: (a: Action) => void; saveOk: boolean; onShowIntro: () => void;
}) {
  const st = state.settings;
  const set = (patch: Partial<Settings>) => dispatch({ type: 'setSettings', patch });
  const decimals = Array.from({ length: MAX_DECIMALS + 1 }, (_, i) => i);
  return (
    <section className="panel settings" aria-label="Cài đặt">
      <label className="row">Số chữ số thập phân
        <select className="field" value={st.decimals === null ? 'auto' : String(st.decimals)}
          onChange={(e) => set({ decimals: e.target.value === 'auto' ? null : Number(e.target.value) })}>
          <option value="auto">Tự động (tối đa 12 chữ số có nghĩa)</option>
          {decimals.map((d) => <option key={d} value={d}>{d} chữ số sau dấu thập phân</option>)}
        </select>
      </label>
      <label className="row">Dấu thập phân
        <select className="field" value={st.decimalSep} onChange={(e) => set({ decimalSep: e.target.value as DecimalSep })}>
          <option value=".">Dấu chấm (3.14), ngăn đối số bằng “,”</option>
          <option value=",">Dấu phẩy (3,14), ngăn đối số bằng “;”</option>
        </select>
      </label>
      <label className="row">Giao diện
        <select className="field" value={st.theme ?? 'system'}
          onChange={(e) => set({ theme: e.target.value === 'system' ? null : (e.target.value as Theme) })}>
          <option value="system">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option>
        </select>
      </label>
      <label className="row">Đơn vị góc
        <select className="field" value={state.angle} onChange={(e) => dispatch({ type: 'setAngle', angle: e.target.value as 'deg' | 'rad' })}>
          <option value="deg">Độ (DEG)</option><option value="rad">Radian (RAD)</option>
        </select>
      </label>
      <div className="row">Hướng dẫn
        <button type="button" className="btn" onClick={onShowIntro}>Xem lại hướng dẫn nhanh</button>
      </div>
      <p className="note">{saveOk
        ? 'Bộ nhớ, lịch sử và cài đặt được lưu tự động trên thiết bị này.'
        : 'Không lưu được dữ liệu trên thiết bị này (trình duyệt đang chặn lưu trữ). Dữ liệu sẽ mất khi đóng ứng dụng.'}</p>
    </section>
  );
}
