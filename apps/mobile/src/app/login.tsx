import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, FormField, FormSection, TextInput } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

export default function LoginScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { errorMessage: sessionError, refresh } = useAuth();
  const [email, setEmail] = useState(process.env.EXPO_PUBLIC_DEMO_EMAIL ?? "");
  const [password, setPassword] = useState(process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn(): Promise<void> {
    if (!email.trim() || !password) {
      setErrorMessage("Email dan kata sandi wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setErrorMessage(
          result.error.message ?? "Login gagal. Periksa kembali email dan kata sandi.",
        );
        return;
      }

      await refresh();
    } catch {
      setErrorMessage("Server Atria tidak dapat dijangkau. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.xl,
          },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandMark} accessibilityLabel="Atria ERP">
          <Text style={styles.brandLetter}>A</Text>
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Masuk ke Atria</Text>
          <Text style={styles.description}>
            Lanjutkan kontrol budget proyek, biaya, dan material dari perangkat ini.
          </Text>
        </View>

        <FormSection presentation="plain">
          <FormField label="Email" required>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="nama@dekoria.id"
              returnKeyType="next"
              value={email}
            />
          </FormField>
          <FormField label="Kata sandi" required>
            <TextInput
              accessibilityLabel="Kata sandi"
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={() => void handleSignIn()}
              placeholder="Masukkan kata sandi"
              returnKeyType="go"
              secureTextEntry
              value={password}
            />
          </FormField>
        </FormSection>

        {errorMessage || sessionError ? (
          <View accessibilityRole="alert" style={styles.errorSurface}>
            <Text style={styles.errorText}>{errorMessage ?? sessionError}</Text>
          </View>
        ) : null}

        <Button loading={isSubmitting} onPress={() => void handleSignIn()}>
          Masuk
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.marginMobile,
  },
  brandMark: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.primary,
  },
  brandLetter: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.extrabold,
    fontSize: 23,
    lineHeight: 27,
  },
  header: { maxWidth: 360, gap: theme.spacing.xs },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.extrabold,
    letterSpacing: -0.45,
    ...theme.typography.title,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.row,
  },
  errorSurface: {
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.criticalContainer,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.critical,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
});
