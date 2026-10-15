package kr.co.buchu.commerce;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "buchu.payments")
public class PaymentProperties {
    private boolean enabled;
    private String clientKey = "";
    private String secretKey = "";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getClientKey() { return clientKey; }
    public void setClientKey(String clientKey) { this.clientKey = clientKey == null ? "" : clientKey.trim(); }
    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey == null ? "" : secretKey.trim(); }
    public boolean ready() { return enabled && !clientKey.isBlank() && !secretKey.isBlank(); }
}
