# CoinCubby Locker Device API Implementation Plan

This plan connects the CoinCubby website, Supabase database, and the physical locker controller.

The current recommended hardware is now Raspberry Pi 2GB. The older ESP32/TFT approach remains useful as reference, but Raspberry Pi is now the main physical controller.

The website should handle the user flow. The ESP32 should handle the physical flow:

- Receive payment instructions and payment updates through the API.
- Detect inserted payment.
- Unlock or release the locker relay.
- Report status back to the system.

## Recommended Architecture

```text
CoinCubby Website
  -> Supabase / API tables
  -> device_commands + payment_sessions
  -> Raspberry Pi polling API
  -> physical locker relay
```

For the first version, use simple polling from the Raspberry Pi every 1 to 3 seconds. It is easier to test than realtime sockets or MQTT.

## Important Rule

Do not put the Supabase service role key in the Raspberry Pi controller code.

For a prototype, the Raspberry Pi can call Supabase Edge Functions with a limited anon key plus a device token stored in the `devices` table.

## Phase 1: Add Device Tables

Run the SQL in:

```text
supabase/sql/locker_device_api_schema.sql
```

This adds:

- `devices`
- `payment_sessions`
- `device_commands`

It also keeps your existing tables such as:

- `customers`
- `lockers`
- `transactions`
- `payments`
- `rates`

## Phase 2: Rental Flow

### Wallet Payment

```text
1. User selects locker.
2. Website calls createRental().
3. Website/API creates transaction with status Active.
4. Website/API records wallet payment.
5. Website/API updates locker to Occupied.
6. Website/API creates device command: unlock_locker.
7. ESP32 reads command and opens the relay.
8. ESP32 marks command completed.
```

### Pay at Device

```text
1. User selects locker.
2. Website calls createRental().
3. Website/API creates transaction with status PaymentPending.
4. Website/API updates locker to Payment Required.
5. Website/API creates payment_session.
6. Website/API creates device command: display_payment.
7. Raspberry Pi receives the payment command.
8. Raspberry Pi reports inserted money.
9. When paid in full, website/API activates the rental.
10. Website/API creates device command: unlock_locker.
11. Raspberry Pi opens the relay and marks command completed.
```

## Phase 3: Return Flow

### No Overtime

```text
1. User clicks Return Locker.
2. User enters 6-digit PIN/passkey.
3. Website verifies the passkey.
4. Website/API completes the rental.
5. Website/API updates locker to Available.
6. Website/API creates device command: release_locker.
7. Raspberry Pi releases the locker and marks command completed.
```

### Overtime Pay at Device

```text
1. User clicks Return Locker.
2. User enters 6-digit PIN/passkey.
3. Website verifies the passkey.
4. Website/API calculates overtime fee.
5. Website/API creates payment_session with type overtime_payment.
6. Website/API creates device command: display_payment.
7. Raspberry Pi shows the overtime amount.
8. Raspberry Pi reports inserted money.
9. When paid in full, website/API completes the rental.
10. Website/API creates device command: release_locker.
11. Raspberry Pi releases the locker and marks command completed.
```

## Phase 4: API Operations

Starter Supabase Edge Function files are included in:

```text
supabase/functions/device-heartbeat/index.ts
supabase/functions/device-next-command/index.ts
supabase/functions/device-payment-progress/index.ts
supabase/functions/device-command-complete/index.ts
```

These operations can be implemented either as Supabase Edge Functions or frontend helper functions using Supabase REST while prototyping.

### Device heartbeat

Purpose: tell the website that the physical controller is online.

```text
Raspberry Pi -> POST /device-heartbeat
```

Payload:

```json
{
  "device_code": "DEVICE001",
  "device_token": "change-me",
  "status": "Online"
}
```

Database update:

```text
devices.last_seen_at = now()
devices.status = Online
```

### Fetch next command

Purpose: allow the Raspberry Pi to fetch the next pending action.

```text
Raspberry Pi -> GET /device-next-command?device_code=DEVICE001
```

Response example:

```json
{
  "command_id": 12,
  "command": "display_payment",
  "locker_id": 3,
  "transaction_id": 45,
  "payment_session_id": 8,
  "payload": {
    "amount_due": 20,
    "locker_number": "A03"
  }
}
```

### Report payment progress

Purpose: record cash inserted at the physical payment device.

```text
Raspberry Pi -> POST /device-payment-progress
```

Payload:

```json
{
  "device_code": "DEVICE001",
  "device_token": "change-me",
  "payment_session_id": 8,
  "amount_inserted": 5
}
```

Expected behavior:

```text
1. Add amount_inserted to payment_sessions.amount_paid.
2. Insert a row in payments when needed.
3. If amount_paid >= amount_due, mark payment_sessions.status = Paid.
4. For rental payment, set transaction status to Active.
5. For overtime payment, complete the transaction.
6. Create unlock_locker or release_locker command.
```

### Mark command complete

Purpose: let the Raspberry Pi confirm it finished an action.

```text
Raspberry Pi -> POST /device-command-complete
```

Payload:

```json
{
  "device_code": "DEVICE001",
  "device_token": "change-me",
  "command_id": 12,
  "result": "success"
}
```

Database update:

```text
device_commands.status = Completed
device_commands.completed_at = now()
```

## Phase 5: Website Changes

Current website behavior already has most of the user flow.

Update `src/lib/supabase.js` later with helper functions such as:

```js
createPaymentSession()
createDeviceCommand()
fetchPaymentSession()
cancelPaymentSession()
```

Then connect them to:

- `createRental()` in `Home.jsx`
- Pay-at-device polling in `Home.jsx`
- Return overtime pay-at-device flow in `Rent.jsx`
- No-overtime return flow in `Rent.jsx`

## Phase 6: Raspberry Pi Controller Setup

Use this folder for the new Raspberry Pi controller:

```text
raspberry-pi/pi-controller
```

The Pi controller replaces the Arduino/ESP32 code. It also includes an optional local status page at:

```text
http://localhost:4177
```

The old Arduino sketch is still kept here for reference:

```text
arduino/CoinCubbyLockerDevice/CoinCubbyLockerDevice.ino
```

Only use it if you go back to ESP32.

## Old ESP32 Arduino Setup

Install these in Arduino IDE:

- `esp32 by Espressif Systems`
- `TFT_eSPI by Bodmer`
- `ArduinoJson`

Use `esp32 by Espressif Systems` for a normal ESP32 DevKit / ESP32-WROOM board.

Use `Arduino ESP32 Boards by Arduino` only if your board is an Arduino Nano ESP32.

Open this sketch in Arduino IDE:

```text
arduino/CoinCubbyLockerDevice/CoinCubbyLockerDevice.ino
```

Edit these values:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_BASE_URL = "https://your-api-or-supabase-function-url";
const char* DEVICE_CODE = "DEVICE001";
const char* DEVICE_TOKEN = "change-me";
```

The sketch sends the token with an `x-device-token` header.

Then set the correct relay pins:

```cpp
const int RELAY_LOCKER_1 = 26;
const int RELAY_LOCKER_2 = 27;
```

## First Test Checklist

1. Add one row to `devices`.
2. Connect one locker relay to the ESP32.
3. Upload the Arduino sketch.
4. Confirm the TFT shows `Device Online`.
5. Manually insert a `device_commands` row with `unlock_locker`.
6. Confirm the relay activates.
7. Add a `payment_sessions` row.
8. Manually insert a `display_payment` command.
9. Confirm the TFT shows the payment amount.
10. Connect the website flow after the device test works.

## Suggested Device Command Values

Use these exact command strings:

```text
display_payment
unlock_locker
lock_locker
release_locker
cancel_payment
```

Use these exact command statuses:

```text
Pending
Processing
Completed
Failed
Cancelled
```

Use these exact payment session statuses:

```text
Pending
Paid
Expired
Cancelled
```
