
# API do Catálogo Balaio de Gato

Para deploy, basta configurar o firebase CLI, logar na conta devbalaiodegato@gmail.com
(com `firebase login`) e rodar o comando:

    firebase deploy --only functions

# URL padrão de deploy

    https://us-central1-dataloadercatalogobalaiogato.cloudfunctions.net

# Exemplos de uso

Obs.: o comando `jq` está sendo usado para format o retorno da API.

    BASE_URL='https://us-central1-dataloadercatalogobalaiogato.cloudfunctions.net'

    # Listar todos animais
    curl $BASE_URL/api/v1/animals | jq .

    # Pegar dados de um animal
    curl $BASE_URL/api/v1/animals/ANIMAL_ID | jq .

    # Atualizar os dados de um animal
    curl $BASE_URL/api/v1/animals/ANIMAL_ID \
      -H 'Content-type: application/json' \
      --data '{"Quando chegou": "teste patch"}' \
      -X PATCH | jq .

    # Criar um novo registro de animal
    curl $BASE_URL/api/v1/animals \
      -H 'Content-type: application/json' \
      --data '{"Nome": "teste patch"}' | jq .
