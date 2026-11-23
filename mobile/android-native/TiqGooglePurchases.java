package com.tenaceiq.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.*;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "TiqGooglePurchases")
public class TiqGooglePurchases extends Plugin {
    private static final String PACKAGE = "com.tenaceiq.app";
    private static final class Spec {
        final String type, option; final long micros;
        Spec(String type, long micros, String option) { this.type=type; this.micros=micros; this.option=option; }
    }
    private final Map<String, Spec> specs = new HashMap<>();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Runnable> waiting = new ArrayList<>();
    private final List<PluginCall> waitingCalls = new ArrayList<>();
    private BillingClient billing;
    private boolean connecting, destroyed;
    private PluginCall purchaseCall;
    private String purchaseProduct, purchaseAccount, purchaseProfile;
    private final Runnable connectionTimeout = () -> failConnection("google_unavailable");

    @Override public void load() {
        /* TIQ_PRODUCT_SPECS */
    }
    private static boolean binding(String value) { return value!=null && value.matches("[0-9a-f]{64}"); }
    private static String failure(int code) {
        if(code==BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) return "google_existing_purchase";
        if(code==BillingClient.BillingResponseCode.BILLING_UNAVAILABLE || code==BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED) return "google_store_unavailable";
        return "google_unavailable";
    }
    private void failConnection(String reason) {
        main.removeCallbacks(connectionTimeout); connecting=false;
        List<PluginCall> calls=new ArrayList<>(waitingCalls); waitingCalls.clear(); waiting.clear();
        for(PluginCall call:calls) call.reject(reason,reason);
    }
    private void connected(PluginCall call, Runnable work) {
        main.post(() -> {
            if(destroyed) { call.reject("google_unavailable","google_unavailable"); return; }
            if(billing==null) billing=BillingClient.newBuilder(getContext()).setListener(this::purchasesUpdated)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().enablePrepaidPlans().build())
                .enableAutoServiceReconnection().build();
            if(billing.isReady()) { work.run(); return; }
            waiting.add(work); waitingCalls.add(call);
            if(connecting) return;
            connecting=true; main.postDelayed(connectionTimeout,15000);
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    main.post(() -> {
                        if(destroyed) return;
                        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) { failConnection(failure(result.getResponseCode())); return; }
                        main.removeCallbacks(connectionTimeout); connecting=false;
                        List<Runnable> actions=new ArrayList<>(waiting); waiting.clear(); waitingCalls.clear();
                        for(Runnable action:actions) action.run();
                    });
                }
                @Override public void onBillingServiceDisconnected() { main.post(() -> { if(connecting) failConnection("google_unavailable"); }); }
            });
        });
    }
    private interface ProductReady { void ready(ProductDetails product, String offer, String price); }
    private void reject(PluginCall call, String code) {
        if(call==purchaseCall) rejectPurchase(code); else call.reject(code,code);
    }
    private void product(PluginCall call, String id, ProductReady ready) {
        Spec spec=specs.get(id);
        if(spec==null) { reject(call,"google_invalid_product"); return; }
        QueryProductDetailsParams params=QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
            QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(spec.type).build())).build();
        billing.queryProductDetailsAsync(params,(result,details) -> main.post(() -> {
            if(destroyed) return;
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) { reject(call,failure(result.getResponseCode())); return; }
            List<ProductDetails> rows=details.getProductDetailsList();
            if(rows.size()!=1 || !id.equals(rows.get(0).getProductId())) { reject(call,"google_products_unavailable"); return; }
            ProductDetails item=rows.get(0); String offer=null,price=null; int matches=0;
            if(!spec.type.equals(item.getProductType())) { reject(call,"google_products_unavailable"); return; }
            if(BillingClient.ProductType.SUBS.equals(spec.type)) {
                List<ProductDetails.SubscriptionOfferDetails> offers=item.getSubscriptionOfferDetails();
                if(offers!=null) for(ProductDetails.SubscriptionOfferDetails candidate:offers) {
                    List<ProductDetails.PricingPhase> phases=candidate.getPricingPhases().getPricingPhaseList();
                    if(spec.option.equals(candidate.getBasePlanId()) && candidate.getOfferId()==null && phases.size()==1) {
                        ProductDetails.PricingPhase phase=phases.get(0);
                        if("USD".equals(phase.getPriceCurrencyCode()) && phase.getPriceAmountMicros()==spec.micros && "P1M".equals(phase.getBillingPeriod()) && phase.getRecurrenceMode()==ProductDetails.RecurrenceMode.INFINITE_RECURRING) {
                            matches++; offer=candidate.getOfferToken(); price=phase.getFormattedPrice();
                        }
                    }
                }
            } else {
                List<ProductDetails.OneTimePurchaseOfferDetails> offers=item.getOneTimePurchaseOfferDetailsList();
                if(offers!=null) for(ProductDetails.OneTimePurchaseOfferDetails candidate:offers) {
                    if(spec.option.equals(candidate.getPurchaseOptionId()) && candidate.getOfferId()==null && candidate.getRentalDetails()==null && candidate.getPreorderDetails()==null && "USD".equals(candidate.getPriceCurrencyCode()) && candidate.getPriceAmountMicros()==spec.micros) {
                        matches++; offer=candidate.getOfferToken(); price=candidate.getFormattedPrice();
                    }
                }
            }
            if(matches!=1 || offer==null || offer.isEmpty() || price==null || price.trim().isEmpty()) { reject(call,"google_products_unavailable"); return; }
            ready.ready(item,offer,price);
        }));
    }
    @PluginMethod public void products(PluginCall call) {
        String id=call.getString("productId");
        if(id==null || !specs.containsKey(id)) { call.reject("google_invalid_product","google_invalid_product"); return; }
        connected(call,() -> product(call,id,(item,offer,price) -> {
            Spec spec=specs.get(id); JSObject row=new JSObject().put("id",id).put("price",price).put("currency","USD").put("micros",spec.micros).put("type",spec.type);
            if(BillingClient.ProductType.SUBS.equals(spec.type)) row.put("period","P1M");
            call.resolve(new JSObject().put("available",true).put("products",new JSArray().put(row)));
        }));
    }
    @PluginMethod public void purchase(PluginCall call) {
        String id=call.getString("productId"),account=call.getString("accountId"),profile=call.getString("profileId"); Spec spec=specs.get(id);
        if(!PACKAGE.equals(getContext().getPackageName())) { call.reject("google_store_unavailable","google_store_unavailable"); return; }
        if(spec==null || !binding(account) || (BillingClient.ProductType.INAPP.equals(spec.type)?!binding(profile):profile!=null)) { call.reject("google_invalid_product","google_invalid_product"); return; }
        connected(call,() -> {
            if(purchaseCall!=null) { call.reject("google_purchase_in_progress","google_purchase_in_progress"); return; }
            purchaseCall=call; purchaseProduct=id; purchaseAccount=account; purchaseProfile=profile;
            product(call,id,(item,offer,price) -> {
                BillingFlowParams.Builder builder=BillingFlowParams.newBuilder().setObfuscatedAccountId(account).setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(item).setOfferToken(offer).build()));
                if(profile!=null) builder.setObfuscatedProfileId(profile);
                BillingResult result=billing.launchBillingFlow(getActivity(),builder.build());
                if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) rejectPurchase(failure(result.getResponseCode()));
            });
        });
    }
    private void rejectPurchase(String code) {
        PluginCall call=purchaseCall; purchaseCall=null; purchaseProduct=null; purchaseAccount=null; purchaseProfile=null;
        if(call!=null) call.reject(code,code);
    }
    private JSObject transaction(Purchase purchase) {
        List<String> products=purchase.getProducts();
        if(products.size()!=1 || !specs.containsKey(products.get(0)) || purchase.getQuantity()!=1) return null;
        AccountIdentifiers account=purchase.getAccountIdentifiers();
        String owner=account==null?null:account.getObfuscatedAccountId(),profile=account==null?null:account.getObfuscatedProfileId();
        Spec spec=specs.get(products.get(0));
        if(!binding(owner) || (BillingClient.ProductType.INAPP.equals(spec.type)?!binding(profile):profile!=null)) return null;
        String state=purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED?"purchased":purchase.getPurchaseState()==Purchase.PurchaseState.PENDING?"pending":null;
        if(state==null || purchase.getPurchaseToken()==null || !purchase.getPurchaseToken().matches("[\\x21-\\x7e]{16,4096}")) return null;
        return new JSObject().put("productId",products.get(0)).put("purchaseToken",purchase.getPurchaseToken()).put("accountId",owner)
            .put("profileId",profile==null?org.json.JSONObject.NULL:profile).put("state",state).put("quantity",1).put("acknowledged",purchase.isAcknowledged()).put("suspended",purchase.isSuspended());
    }
    private void purchasesUpdated(BillingResult result, List<Purchase> purchases) {
        main.post(() -> {
            if(destroyed) return;
            notifyListeners("transactionsChanged",new JSObject());
            if(purchaseCall==null) return;
            int code=result.getResponseCode();
            if(code==BillingClient.BillingResponseCode.USER_CANCELED) { PluginCall call=purchaseCall; purchaseCall=null; purchaseProduct=null; purchaseAccount=null; purchaseProfile=null; call.resolve(new JSObject().put("state","cancelled")); return; }
            if(code!=BillingClient.BillingResponseCode.OK || purchases==null || purchases.size()>50) { rejectPurchase(failure(code)); return; }
            for(Purchase purchase:purchases) {
                if(!purchase.getProducts().equals(Collections.singletonList(purchaseProduct))) continue;
                if(purchase.getPurchaseState()==Purchase.PurchaseState.PENDING && purchase.getQuantity()==1) {
                    PluginCall call=purchaseCall; purchaseCall=null; purchaseProduct=null; purchaseAccount=null; purchaseProfile=null; call.resolve(new JSObject().put("state","pending")); return;
                }
                JSObject row=transaction(purchase);
                if(row==null || !purchaseAccount.equals(row.getString("accountId")) || !java.util.Objects.equals(purchaseProfile,row.isNull("profileId")?null:row.getString("profileId"))) { rejectPurchase("google_account_mismatch"); return; }
                PluginCall call=purchaseCall; purchaseCall=null; purchaseProduct=null; purchaseAccount=null; purchaseProfile=null; call.resolve(row); return;
            }
            rejectPurchase("google_purchase_sync_pending");
        });
    }
    @PluginMethod public void pending(PluginCall call) {
        connected(call,() -> {
            JSArray rows=new JSArray(); int[] outstanding={2}; boolean[] failed={false};
            for(String type:new String[]{BillingClient.ProductType.SUBS,BillingClient.ProductType.INAPP}) {
                QueryPurchasesParams.Builder params=QueryPurchasesParams.newBuilder().setProductType(type);
                if(BillingClient.ProductType.SUBS.equals(type)) params.includeSuspendedSubscriptions(true);
                billing.queryPurchasesAsync(params.build(),(result,purchases) -> main.post(() -> {
                    if(destroyed || failed[0]) return;
                    if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK || purchases.size()>50) { failed[0]=true; String code=failure(result.getResponseCode()); call.reject(code,code); return; }
                    for(Purchase purchase:purchases) { JSObject row=transaction(purchase); if(row!=null) rows.put(row); }
                    if(rows.length()>50) { failed[0]=true; call.reject("google_unavailable","google_unavailable"); return; }
                    if(--outstanding[0]==0) call.resolve(new JSObject().put("transactions",rows));
                }));
            }
        });
    }
    @PluginMethod public void manage(PluginCall call) {
        main.post(() -> {
            try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/account/subscriptions?sku=com.tenaceiq.app.pro.monthly&package="+PACKAGE))); call.resolve(); }
            catch(Exception error) { call.reject("google_store_unavailable","google_store_unavailable"); }
        });
    }
    @Override protected void handleOnResume() { if(billing!=null && !destroyed) notifyListeners("transactionsChanged",new JSObject()); }
    @Override protected void handleOnDestroy() {
        destroyed=true; failConnection("google_unavailable"); rejectPurchase("google_purchase_sync_pending");
        if(billing!=null) billing.endConnection();
    }
}
