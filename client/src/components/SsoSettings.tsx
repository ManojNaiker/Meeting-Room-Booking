import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmailSettingsSchema, type EmailSettings } from "@shared/schema";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";

export default function SsoSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<EmailSettings>({
    queryKey: ["/api/admin/email-settings"],
  });

  const form = useForm({
    resolver: zodResolver(insertEmailSettingsSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      fromEmail: "",
      fromName: "",
      enableBookingNotifications: true,
      enableReminders: true,
      enablePasswordReset: true,
      enableLdap: false,
      enableSso: false,
      samlEntryPoint: "",
      samlIssuer: "",
      samlCert: "",
      samlServiceProvider: "Skillmine",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        ...settings,
        samlEntryPoint: settings.samlEntryPoint || "",
        samlIssuer: settings.samlIssuer || "",
        samlCert: settings.samlCert || "",
        samlServiceProvider: settings.samlServiceProvider || "Skillmine",
      } as any);
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("/api/admin/email-settings", {
        method: "POST",
        body: JSON.stringify(values),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-settings"] });
      toast({
        title: "Settings updated",
        description: "SSO configuration has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">SSO Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure SAML Single Sign-On with Skillmine.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SAML Authentication</CardTitle>
                  <CardDescription>
                    Enable and configure SAML-based SSO for your organization.
                  </CardDescription>
                </div>
                <FormField
                  control={form.control}
                  name="enableSso"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enable-sso"
                        />
                      </FormControl>
                      <FormLabel>Enable SSO</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="samlServiceProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Provider</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly disabled className="bg-muted" />
                      </FormControl>
                      <FormDescription>The SAML Service Provider name.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="samlIssuer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identity Provider Issuer (Entity ID)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://skillmine.example.com/adfs/services/trust" data-testid="input-saml-issuer" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="samlEntryPoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SAML Entry Point (SSO URL)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://skillmine.example.com/adfs/ls/" data-testid="input-saml-entry-point" />
                    </FormControl>
                    <FormDescription>The URL where the SAML authentication request will be sent.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="samlCert"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public X.509 Certificate</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" 
                        className="font-mono h-32"
                        data-testid="textarea-saml-cert"
                      />
                    </FormControl>
                    <FormDescription>The public certificate provided by Skillmine for signature verification.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-md bg-muted p-4 flex items-start space-x-3 mt-4">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Metadata URL</p>
                  <p className="text-muted-foreground mt-1">
                    Provide this URL to Skillmine to complete the trust relationship:
                  </p>
                  <code className="block mt-2 p-2 bg-background rounded border text-xs break-all">
                    {window.location.origin}/api/auth/saml/metadata
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-sso">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save SSO Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
