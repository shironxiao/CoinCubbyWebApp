# CoinCubby Raspberry Pi Controller

This replaces the ESP32 sketch when the locker uses a Raspberry Pi 2GB.

The Raspberry Pi does two main jobs:

- Polls Supabase Edge Functions for website rental commands.
- Pulses GPIO relays to open the 12V cabinet locks.

A small local status page is included only for testing and monitoring. It is optional and does not require an LCD.

## Hardware

Use:

- Raspberry Pi 2GB
- 16-channel relay module that accepts Raspberry Pi 3.3V GPIO logic
- 12V power supply for the cabinet locks
- DC12V cabinet locks

Do not power cabinet locks from the Raspberry Pi.

## Setup

1. Install Raspberry Pi OS.
2. Connect Wi-Fi from the Raspberry Pi desktop.
3. Install Node.js 18 or newer.
4. Copy this folder to the Raspberry Pi.
5. Copy `.env.example` to `.env`.
6. Update `DEVICE_TOKEN` to match `devices.token_hash` in Supabase.
7. Update `LOCKER_1_GPIO` to `LOCKER_16_GPIO` if your wiring uses different pins.
8. Start the controller:

```bash
npm start
```

Optional local status/test page:

```text
http://localhost:4177
```

## Important

`API_BASE_URL` must use Supabase Functions:

```text
https://cjuimxgxovdmijuenagr.supabase.co/functions/v1
```

Do not use `/rest/v1` for the Raspberry Pi controller because the controller calls custom functions like:

- `/device-heartbeat`
- `/device-next-command`
- `/device-command-complete`
- `/device-payment-progress`

## Optional Local Status Page

The included local page shows:

- Device status
- Last command
- Last error
- Relay test button
- Payment key input for active payment sessions

The customer-facing physical rental screen can be added later when you have the LCD.

## Payment Input Mapping

The current bill acceptor key mapping is:

```text
F12 = 20 pesos
F13 = 50 pesos
F14 = 100 pesos
```

When the local page is open and focused, these keypresses are sent to the active Supabase payment session.

The coin acceptor uses GPIO pulses:

```text
1 pulse = 5 pesos
2 pulses = 10 pesos
```

Set the coin acceptor input pin in `.env`:

```text
COIN_PULSE_GPIO=4
COIN_PULSE_VALUE=5
```
