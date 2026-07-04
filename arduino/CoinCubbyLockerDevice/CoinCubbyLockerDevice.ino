// CoinCubby ESP32 locker controller.
// This sketch connects the physical locker kiosk to the CoinCubby website through Supabase Edge Functions.

// WiFi.h connects the ESP32 to your 2.4 GHz Wi-Fi network.
#include <WiFi.h>

// HTTPClient.h lets the ESP32 call your Supabase API/Edge Function URLs.
#include <HTTPClient.h>

// ArduinoJson.h is used to build and read JSON data sent to/from Supabase.
#include <ArduinoJson.h>

// TFT_eSPI.h controls the TFT display screen.
#include <TFT_eSPI.h>

// Main TFT display object. The display pins are configured in TFT_eSPI's User_Setup.h file.
TFT_eSPI tft = TFT_eSPI();

// Put your router or phone hotspot Wi-Fi name here.
// Important: ESP32 usually needs 2.4 GHz Wi-Fi, not 5 GHz.
const char* WIFI_SSID = "YOUR_WIFI_NAME";

// Put your Wi-Fi password here.
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase Edge Function base URL.
// Keep /functions/v1 here because this sketch calls paths like /device-heartbeat.
const char* API_BASE_URL = "https://cjuimxgxovdmijuenagr.supabase.co/functions/v1";

// Supabase public/anon key. This is safe for client devices.
// Never put the Supabase service_role key in ESP32 code.
const char* SUPABASE_ANON_KEY = "sb_publishable_YthaUzaLsciMAsHKqzVqnw_g_Whatd1";

// Device code must match the device_code row in your Supabase devices table.
const char* DEVICE_CODE = "DEVICE001";

// Device token must match devices.token_hash in Supabase for this prototype.
// Change this before final deployment.
const char* DEVICE_TOKEN = "change-me";

// Relay GPIO pins. Each relay controls one 12V cabinet lock.
// Add more relay pins here for all 16 lockers.
const int RELAY_LOCKER_1 = 26;
const int RELAY_LOCKER_2 = 27;

// These timers control how often the ESP32 talks to the server.
unsigned long lastHeartbeatMs = 0;
unsigned long lastCommandPollMs = 0;

void setup() {
  // Serial Monitor is used for debugging in Arduino IDE.
  Serial.begin(115200);

  // Set relay pins as outputs.
  pinMode(RELAY_LOCKER_1, OUTPUT);
  pinMode(RELAY_LOCKER_2, OUTPUT);

  // Keep relays OFF when the ESP32 starts.
  digitalWrite(RELAY_LOCKER_1, LOW);
  digitalWrite(RELAY_LOCKER_2, LOW);

  // Start the TFT screen and show boot status.
  tft.init();
  tft.setRotation(1);
  showMessage("CoinCubby", "Connecting WiFi...");

  // Connect to Wi-Fi before checking locker commands.
  connectWiFi();
  showMessage("CoinCubby", "Device Online");
}

void loop() {
  // If Wi-Fi disconnects, reconnect automatically.
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long now = millis();

  // Send heartbeat every 15 seconds so the website knows the device is online.
  if (now - lastHeartbeatMs > 15000) {
    sendHeartbeat();
    lastHeartbeatMs = now;
  }

  // Check every 2 seconds if the website/Supabase has a command for this device.
  if (now - lastCommandPollMs > 2000) {
    checkNextCommand();
    lastCommandPollMs = now;
  }
}

void connectWiFi() {
  // Start Wi-Fi connection using the name and password above.
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Wait here until the ESP32 connects.
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Connected. IP: ");
  Serial.println(WiFi.localIP());
}

void showMessage(const String& title, const String& line) {
  // Simple helper for writing two lines to the TFT screen.
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(12, 20);
  tft.println(title);
  tft.setTextSize(1);
  tft.setCursor(12, 58);
  tft.println(line);
}

String postJson(const String& path, const String& body) {
  // Sends JSON data to a Supabase Edge Function.
  // Example path: /device-heartbeat
  HTTPClient http;
  String url = String(API_BASE_URL) + path;

  http.begin(url);

  // Supabase needs these headers so it accepts the request.
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  // This custom token proves which ESP32 device is calling.
  http.addHeader("x-device-token", DEVICE_TOKEN);

  int statusCode = http.POST(body);
  String response = http.getString();

  Serial.print("POST ");
  Serial.print(path);
  Serial.print(" -> ");
  Serial.println(statusCode);

  http.end();
  return response;
}

String getJson(const String& path) {
  // Gets JSON data from a Supabase Edge Function.
  // Example path: /device-next-command?device_code=DEVICE001
  HTTPClient http;
  String url = String(API_BASE_URL) + path;

  http.begin(url);

  // Required Supabase headers.
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  // Device security token.
  http.addHeader("x-device-token", DEVICE_TOKEN);

  int statusCode = http.GET();
  String response = http.getString();

  Serial.print("GET ");
  Serial.print(path);
  Serial.print(" -> ");
  Serial.println(statusCode);

  http.end();
  return response;
}

void sendHeartbeat() {
  // Tells Supabase that this ESP32 is online.
  StaticJsonDocument<256> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["device_token"] = DEVICE_TOKEN;
  doc["status"] = "Online";

  String body;
  serializeJson(doc, body);
  postJson("/device-heartbeat", body);
}

void checkNextCommand() {
  // Ask Supabase if there is a pending command for this device.
  // Commands can be: display_payment, unlock_locker, release_locker, lock_locker, cancel_payment.
  String path = String("/device-next-command?device_code=") + DEVICE_CODE;
  String response = getJson(path);

  // No command available.
  if (response.length() == 0 || response == "null") {
    return;
  }

  // Convert the server response JSON into Arduino variables.
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, response);

  if (error) {
    Serial.println("Could not parse command JSON.");
    return;
  }

  int commandId = doc["command_id"] | 0;
  String command = doc["command"] | "";
  int lockerId = doc["locker_id"] | 0;

  // If the response is empty or invalid, do nothing.
  if (commandId == 0 || command.length() == 0) {
    showMessage("CoinCubby", "Waiting...");
    return;
  }

  // Payment command: show the amount on the TFT screen.
  if (command == "display_payment") {
    float amountDue = doc["payload"]["amount_due"] | 0;
    String lockerNumber = doc["payload"]["locker_number"] | String(lockerId);
    handleDisplayPayment(commandId, lockerNumber, amountDue);
    return;
  }

  // Locker opening commands: pulse the relay so the 12V cabinet lock opens.
  if (command == "unlock_locker" || command == "release_locker") {
    handleRelayCommand(commandId, lockerId, command);
    return;
  }

  // For now, these commands are acknowledged without special hardware action.
  if (command == "lock_locker" || command == "cancel_payment") {
    markCommandComplete(commandId, "success");
    showMessage("CoinCubby", "Command completed");
  }
}

void handleDisplayPayment(int commandId, const String& lockerNumber, float amountDue) {
  // Show payment instructions on the TFT.
  // The actual coin/bill sensor should call reportInsertedPayment().
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(12, 18);
  tft.print("Locker ");
  tft.println(lockerNumber);

  tft.setTextSize(1);
  tft.setCursor(12, 58);
  tft.println("Insert payment at kiosk");

  tft.setTextSize(2);
  tft.setCursor(12, 88);
  tft.print("Due: ");
  tft.println(amountDue, 2);

  markCommandComplete(commandId, "success");
}

void handleRelayCommand(int commandId, int lockerId, const String& command) {
  // Find which ESP32 GPIO pin controls this locker.
  int relayPin = relayPinForLocker(lockerId);

  if (relayPin < 0) {
    markCommandComplete(commandId, "failed");
    showMessage("CoinCubby", "Unknown locker relay");
    return;
  }

  showMessage("CoinCubby", command == "unlock_locker" ? "Unlocking..." : "Releasing...");

  // Turn relay ON briefly, then OFF.
  // This gives 12V power to the cabinet lock just long enough to pop open.
  digitalWrite(relayPin, HIGH);
  delay(1200);
  digitalWrite(relayPin, LOW);

  markCommandComplete(commandId, "success");
  showMessage("CoinCubby", "Locker ready");
}

int relayPinForLocker(int lockerId) {
  // Map database locker IDs to relay pins.
  // Add lockers 3 to 16 here when you wire the full relay board.
  if (lockerId == 1) return RELAY_LOCKER_1;
  if (lockerId == 2) return RELAY_LOCKER_2;
  return -1;
}

void reportInsertedPayment(int paymentSessionId, float amountInserted) {
  // Call this when your coin acceptor/bill acceptor detects payment.
  // Example: reportInsertedPayment(8, 5.00) means payment session 8 received 5 pesos.
  StaticJsonDocument<256> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["device_token"] = DEVICE_TOKEN;
  doc["payment_session_id"] = paymentSessionId;
  doc["amount_inserted"] = amountInserted;

  String body;
  serializeJson(doc, body);
  postJson("/device-payment-progress", body);
}

void markCommandComplete(int commandId, const String& result) {
  // Tell Supabase that the ESP32 finished a command.
  // result should be "success" or "failed".
  StaticJsonDocument<256> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["device_token"] = DEVICE_TOKEN;
  doc["command_id"] = commandId;
  doc["result"] = result;

  String body;
  serializeJson(doc, body);
  postJson("/device-command-complete", body);
}
