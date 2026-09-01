import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";

const CorDestaque = "#8E1948";
const CorCaixaClara = "#F8D7E3";

export default function RecuperarSenhaScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  function emailValido(valor: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }

  async function handleEnviar() {
    if (!email.trim()) {
      Alert.alert("Campo obrigatório", "Digite seu e-mail.");
      return;
    }
    if (!emailValido(email)) {
      Alert.alert("E-mail inválido", "Digite um e-mail válido.");
      return;
    }

    setCarregando(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (erro: any) {
    } finally {
      setCarregando(false);
      setEmailEnviado(true);
    }
  }

  return (
    <LinearGradient colors={["#8E1948", "#C24B72", "#F8D7E3"]} style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.cabecalho}>
          <Image source={require("../../../assets/rosa-logo.png")} style={styles.logo} />
          <Text style={styles.nomeApp}>Rosa IA</Text>
        </View>

        <Text style={styles.titulo}>Recuperação</Text>

        <Text style={styles.descricao}>
          Informe o e-mail da sua conta que enviaremos as instruções para redefinir sua senha.
        </Text>

        <View style={styles.campoComIcone}>
          <Ionicons name="mail-outline" size={20} color={CorDestaque} style={styles.iconeEsquerda} />
          <View style={{ flex: 1 }}>
            <Text style={styles.labelDentro}>
              E-mail <Text style={styles.asterisco}>*</Text>
            </Text>
            <TextInput
              style={styles.inputDentro}
              placeholder="Digite seu e-mail"
              placeholderTextColor="#9C7284"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.botao} onPress={handleEnviar} disabled={carregando}>
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBotao}>Enviar</Text>
          )}
        </TouchableOpacity>

        <View style={styles.mensagemContainer}>
            <Text style={styles.mensagemSucesso}>
                {emailEnviado ? "Um link de recuperação foi enviado para seu e-mail" : ""}
            </Text>
        </View>

        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.linkVoltar}>Voltar</Text>
        </TouchableOpacity>

        <Image source={require("../../../assets/uniceplac-logo.png")} style={styles.logoUniceplac} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20, paddingTop: 18, justifyContent: "flex-start" },
  cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginBottom: 0 },
  logo: { width: 190, height: 190, resizeMode: "contain", marginRight: -20 },
  nomeApp: { fontSize: 26, fontWeight: "bold", color: "#fff" },
  titulo: { fontSize: 42, fontWeight: "bold", color: "#fff", textAlign: "center", marginTop: -28, marginBottom: 44 },
  descricao: { color: "#fff", fontSize: 17, textAlign: "center", marginBottom: 48, lineHeight: 24 },
  campoComIcone: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CorCaixaClara,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 36,
  },
  iconeEsquerda: { marginRight: 8 },
  labelDentro: { color: "#2A0A16", fontWeight: "600", fontSize: 13 },
  asterisco: { color: "#FF3B30" },
  inputDentro: { color: "#2A0A16", fontSize: 15, paddingVertical: 2 },
  botao: { backgroundColor: CorDestaque, borderRadius: 30, padding: 16, alignItems: "center" },
  textoBotao: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  mensagemContainer: { height: 50, justifyContent: "center", marginTop: 40 },
  mensagemSucesso: { color: "#fff", textAlign: "center", fontSize: 17, lineHeight: 22 },
  linkVoltar: { color: CorDestaque, fontWeight: "bold", textAlign: "center", marginTop: 40 },
  logoUniceplac: { width: 170, height: 100, resizeMode: "contain", alignSelf: "center", marginTop: 32 },
});