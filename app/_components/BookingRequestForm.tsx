const timezoneOptions = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
];

export function BookingRequestFields({
  defaultTimezone = "America/Los_Angeles",
}: {
  defaultTimezone?: string;
}) {
  return (
    <div className="booking-request-fields">
      <label>
        <span>Your name</span>
        <input autoComplete="name" name="customerName" placeholder="Your name" />
      </label>
      <label>
        <span>Email for invite</span>
        <input
          autoComplete="email"
          name="customerEmail"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>
      <label>
        <span>Requested time</span>
        <input name="appointmentStartAt" required type="datetime-local" />
      </label>
      <label>
        <span>Timezone</span>
        <input
          defaultValue={defaultTimezone}
          list="booking-timezone-options"
          name="timezone"
          required
        />
      </label>
      <datalist id="booking-timezone-options">
        {timezoneOptions.map((timezone) => (
          <option key={timezone} value={timezone} />
        ))}
      </datalist>
      <label className="booking-request-wide">
        <span>What should they help with?</span>
        <textarea
          name="customerNote"
          placeholder="Add the decision, outfit, room, cart, or question you want to bring."
          rows={3}
        />
      </label>
    </div>
  );
}
