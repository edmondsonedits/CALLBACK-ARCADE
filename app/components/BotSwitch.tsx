export default function BotSwitch({ number, enabled, disabled, onChange }: {
  number: number; enabled: boolean; disabled?: boolean; onChange: (enabled: boolean) => void;
}) {
  return <button type="button" className="bot-seat-switch" role="switch" aria-label={`Bot ${number}`} aria-checked={enabled} disabled={disabled} data-on={enabled} onClick={() => onChange(!enabled)}>
    <span>Bot</span><span className="bot-seat-track" aria-hidden="true"><span className="bot-seat-state">{enabled ? 'On' : 'Off'}</span><span className="bot-seat-knob" /></span>
  </button>;
}
