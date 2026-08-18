import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, FormField, FormSection, TextInput } from "@/components/ui";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

/**
 * Satu-satunya layar yang boleh dibuka akun dengan `mustChangePassword=true`.
 *
 * Gate di root layout menahan akun tersebut di sini, dan mutation-nya adalah
 * satu-satunya prosedur tRPC yang memakai `protectedProcedure`. Setelah sukses,
 * server sudah mencabut seluruh sesi, jadi sesi lokal ikut dibersihkan dan
 * pengguna wajib login ulang dengan kata sandi barunya.
 */
export default function ChangeTemporaryPasswordScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function readZodFieldErrors(error: unknown): { currentPassword?: string; newPassword?: string } {
    if (typeof error !== "object" || error === null) return {};
    const data = (error as { data?: { zod?: Record<string, string[]> } }).data;
    const zod = data?.zod;
    if (!zod) return {};

    return {
      currentPassword: zod.currentPassword?.[0],
      newPassword: zod.newPassword?.[0],
    };
  }

  async function handleSubmit(): Promise<void> {
    if (!currentPassword || !newPassword) {
      setErrorMessage("Kata sandi sementara dan kata sandi baru wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const result = await trpcClient.administration.changeTemporaryPassword.mutate({
        currentPassword,
        newPassword,
      });

      if (!result.success) {
        setErrorMessage(result.error.message);
        return;
      }

      // Server sudah menghapus semua sesi. Bersihkan token lokal supaya gate
      // kembali ke login, lalu paksa login ulang dengan kata sandi baru.
      setCurrentPassword("");
      setNewPassword("");
      await signOut();
    } catch (error) {
      const zodErrors = readZodFieldErrors(error);
      if (zodErrors.currentPassword || zodErrors.newPassword) {
        setFieldErrors(zodErrors);
        setErrorMessage("Periksa kembali kata sandi yang dimasukkan.");
        return;
      }

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
        <View style={styles.header}>
          <Text style={styles.title}>Buat kata sandi baru</Text>
          <Text style={styles.description}>
            Akun {user?.email ?? "ini"} masih memakai kata sandi sementara. Buat kata sandi pribadi
            sebelum melanjutkan.
          </Text>
        </View>

        <FormSection
          helper="Minimal 12 karakter, dengan huruf besar, huruf kecil, dan angka."
          title="Kata sandi"
        >
          <FormField error={fieldErrors.currentPassword} label="Kata sandi sementara" required>
            <TextInput
              accessibilityLabel="Kata sandi sementara"
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect={false}
              editable={!isSubmitting}
              invalid={Boolean(fieldErrors.currentPassword)}
              onChangeText={setCurrentPassword}
              placeholder="Kata sandi dari admin"
              returnKeyType="next"
              secureTextEntry
              textContentType="password"
              value={currentPassword}
            />
          </FormField>

          <FormField
            error={fieldErrors.newPassword}
            helper="Tidak boleh sama dengan kata sandi sementara."
            label="Kata sandi baru"
            required
          >
            <TextInput
              accessibilityLabel="Kata sandi baru"
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              editable={!isSubmitting}
              invalid={Boolean(fieldErrors.newPassword)}
              onChangeText={setNewPassword}
              onSubmitEditing={() => void handleSubmit()}
              placeholder="Kata sandi pribadi"
              returnKeyType="done"
              secureTextEntry
              textContentType="newPassword"
              value={newPassword}
            />
          </FormField>
        </FormSection>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button loading={isSubmitting} onPress={() => void handleSubmit()}>
            Simpan kata sandi
          </Button>
          <Button disabled={isSubmitting} onPress={() => void signOut()} variant="secondary">
            Keluar dari akun ini
          </Button>
        </View>

        <Text style={styles.footnote}>
          Setelah tersimpan, semua sesi lama dikeluarkan dan kamu perlu masuk lagi dengan kata sandi
          baru.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: theme.spacing.xs,
  },
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.marginMobile,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    fontSize: theme.typography.support.fontSize,
    lineHeight: theme.typography.support.lineHeight,
  },
  error: {
    color: theme.colors.critical,
    fontFamily: theme.fonts.semibold,
    fontSize: theme.typography.support.fontSize,
    lineHeight: theme.typography.support.lineHeight,
  },
  footnote: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
  },
  header: {
    gap: theme.spacing.base,
  },
  keyboard: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    fontSize: theme.typography.title.fontSize,
    lineHeight: theme.typography.title.lineHeight,
  },
});
