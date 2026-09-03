import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../../config/firebase";

const CorTexto = "#8E1948";
const CorFundo = "#FBE1EA";
const CorPerigo = "#D32F2F";
const CorCaixaClara = "#F8D7E3";

export default function ExcluirContaScreen({ navigation }: any) {
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  function mensagemDeErro(codigo: string) {
    switch (codigo) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Senha incorreta.";
      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente em alguns minutos.";
      default:
        return "Não foi possível excluir a conta. Tente novamente.";
    }
  }

  async function handleExcluir() {
    const usuario = auth.currentUser;
    if (!usuario?.email) return;

    if (!senha) {
      Alert.alert("Senha obrigatória", "Digite sua senha para confirmar.");
      return;
    }

    Alert.alert(
      "Excluir conta",
      "Esta ação é permanente e não pode ser desfeita. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setCarregando(true);
            try {
              const credencial = EmailAuthProvider.credential(usuario.email!, senha);
              await reauthenticateWithCredential(usuario, credencial);
              await deleteUser(usuario);
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            } catch (erro: any) {
              Alert.alert("Erro", mensagemDeErro(erro.code));
            } finally {
              setCarregando(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.botaoVoltar} onPress={() => navigation?.goBack()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      <View style={styles.conteudo}>
        <Ionicons name="warning-outline" size={64} color={CorPerigo} style={{ marginBottom: 16 }} />

        <Text style={styles.titulo}>Excluir Conta</Text>
        <Text style={styles.descricao}>
          Esta ação é permanente. Todos os seus dados, incluindo histórico de conversas, serão apagados e não
          poderão ser recuperados.
        </Text>

        <View style={styles.campoComIcone}>
          <Ionicons name="lock-closed-outline" size={20} color={CorTexto} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            placeholder="Confirme sua senha"
            placeholderTextColor="#9C7284"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry={!mostrarSenha}
          />
          <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
            <Ionicons name={mostrarSenha ? "eye-off-outline" : "eye-outline"} size={20} color={CorTexto} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.botaoExcluir} onPress={handleExcluir} disabled={carregando}>
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBotaoExcluir}>Excluir minha conta</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.linkCancelar}>Cancelar</Text>
        </TouchableOpacity>
        <Image source={require("../../../assets/uniceplac-logo.png")} style={styles.logoUniceplac} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CorFundo },
  botaoVoltar: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0356F",
    alignItems: "center",
    justifyContent: "center",
  },
  conteudo: { flex: 1, padding: 24, paddingTop: 130, alignItems: "center" },
  titulo: { fontSize: 28, fontWeight: "bold", color: CorPerigo, marginBottom: 12 },
  descricao: { fontSize: 15, color: CorTexto, textAlign: "center", lineHeight: 21, marginBottom: 28 },
  campoComIcone: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CorCaixaClara,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: "100%",
    marginBottom: 24,
  },
  input: { flex: 1, color: "#2A0A16", fontSize: 15 },
  botaoExcluir: {
    backgroundColor: CorPerigo,
    borderRadius: 30,
    padding: 16,
    alignItems: "center",
    width: "100%",
  },
  textoBotaoExcluir: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  linkCancelar: { color: CorTexto, fontWeight: "bold", marginTop: 20 },
  logoUniceplac: { width: 170, height: 100, resizeMode: "contain", marginTop: 235 },
});