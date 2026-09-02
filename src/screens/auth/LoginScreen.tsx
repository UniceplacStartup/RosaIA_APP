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
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebase";

const CorDestaque = "#8E1948";
const CorCaixaClara = "#F8D7E3";
const CorCaixaEscura = "#D998B5";

function CampoComIcone({
  icone,
  label,
  valor,
  aoMudar,
  placeholder,
  secreto,
  mostrarTexto,
  aoAlternarMostrar,
  teclado,
}: {
  icone: any;
  label: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  secreto?: boolean;
  mostrarTexto?: boolean;
  aoAlternarMostrar?: () => void;
  teclado?: "default" | "email-address";
}) {
  return (
    <View style={styles.campoComIcone}>
      <Ionicons name={icone} size={20} color={CorDestaque} style={styles.iconeEsquerda} />
      <View style={{ flex: 1 }}>
        <Text style={styles.labelDentro}>
          {label} <Text style={styles.asterisco}>*</Text>
        </Text>
        <TextInput
          style={styles.inputDentro}
          placeholder={placeholder}
          placeholderTextColor="#9C7284"
          value={valor}
          onChangeText={aoMudar}
          autoCapitalize={teclado === "email-address" ? "none" : "sentences"}
          keyboardType={teclado || "default"}
          secureTextEntry={secreto ? !mostrarTexto : false}
        />
      </View>
      {secreto && (
        <TouchableOpacity onPress={aoAlternarMostrar} style={styles.iconeDireita}>
          <Ionicons name={mostrarTexto ? "eye-off-outline" : "eye-outline"} size={20} color={CorDestaque} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrarAcesso, setLembrarAcesso] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  function mensagemDeErro(codigo: string) {
    switch (codigo) {
      case "auth/invalid-email":
        return "E-mail inválido.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "E-mail ou senha incorretos.";
      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente em alguns minutos.";
      default:
        return "Não foi possível entrar. Tente novamente.";
    }
  }

  async function handleEntrar() {
    if (!email.trim() || !senha) {
      Alert.alert("Campos obrigatórios", "Preencha e-mail e senha.");
      return;
    }

    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      navigation.replace("Perfil");
    } catch (erro: any) {
      Alert.alert("Erro", mensagemDeErro(erro.code));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <LinearGradient colors={["#8E1948", "#C24B72", "#F8D7E3"]} style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.cabecalho}>
          <Image source={require("../../../assets/rosa-logo.png")} style={styles.logo} />
          <Text style={styles.nomeApp}>Rosa IA</Text>
        </View>

        <Text style={styles.titulo}>Acessar Conta</Text>

        <CampoComIcone
          icone="mail-outline"
          label="E-mail"
          valor={email}
          aoMudar={setEmail}
          placeholder="Digite seu e-mail"
          teclado="email-address"
        />
        <CampoComIcone
          icone="lock-closed-outline"
          label="Senha"
          valor={senha}
          aoMudar={setSenha}
          placeholder="Digite sua senha"
          secreto
          mostrarTexto={mostrarSenha}
          aoAlternarMostrar={() => setMostrarSenha(!mostrarSenha)}
        />

        <TouchableOpacity style={styles.linhaLembrar} onPress={() => setLembrarAcesso(!lembrarAcesso)}>
          <View style={styles.checkbox}>
            {lembrarAcesso && <Ionicons name="checkmark" size={14} color={CorDestaque} />}
          </View>
          <Text style={styles.textoLembrar}>
            Lembrar do meu acesso ao <Text style={styles.linkDestacado}>Rosa IA</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botao} onPress={handleEntrar} disabled={carregando}>
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBotao}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation?.navigate("RecuperarSenha")}>
          <Text style={styles.linkEsqueci}>Esqueci minha senha</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation?.navigate("Cadastro")}>
          <Text style={styles.linkLogin}>
            Não possui uma conta? <Text style={styles.linkDestacado}>Criar</Text>
          </Text>
        </TouchableOpacity>

        <Image source={require("../../../assets/uniceplac-logo.png")} style={styles.logoUniceplac} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20, paddingTop: 40, justifyContent: "flex-start" },
  cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginBottom: 0 },
  logo: { width: 190, height: 190, resizeMode: "contain", marginRight: -20 },
  nomeApp: { fontSize: 26, fontWeight: "bold", color: "#fff", marginTop: -30 },
  titulo: { fontSize: 42, fontWeight: "bold", color: "#fff", textAlign: "center", marginTop: -28, marginBottom: 80 },
  campoComIcone: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CorCaixaClara,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 22,
  },
  iconeEsquerda: { marginRight: 8 },
  iconeDireita: { marginLeft: 8 },
  labelDentro: { color: "#2A0A16", fontWeight: "600", fontSize: 13 },
  asterisco: { color: "#FF3B30" },
  inputDentro: { color: "#2A0A16", fontSize: 15, paddingVertical: 2 },
  linhaLembrar: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: CorCaixaEscura,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textoLembrar: { color: "#2A0A16", fontSize: 13 },
  linkDestacado: { color: CorDestaque, fontWeight: "bold" },
  botao: { backgroundColor: CorDestaque, borderRadius: 30, padding: 16, alignItems: "center", marginTop: 28 },
  textoBotao: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  linkEsqueci: { color: CorDestaque, fontWeight: "bold", textAlign: "center", marginTop: 30 },
  linkLogin: { color: "#2A0A16", textAlign: "center", marginTop: 34 },
  logoUniceplac: { width: 170, height: 100, resizeMode: "contain", alignSelf: "center", marginTop: 20 },
});