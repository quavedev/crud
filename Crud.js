import React, { useState } from 'react';
import { Form } from 'meteor/quave:forms/Form';
import { useQuery, useMutation } from '@apollo/react-hooks';
import gql from 'graphql-tag';
import { defaultFormatValue } from './defaultFormatValue';
import { buildRoute, getRidOfTheAnnoyingTypenameFieldDeep } from './helpers';
import {
  Route,
  Switch,
  useHistory,
  useParams,
  useRouteMatch,
} from 'react-router-dom';

const defaultStyles = {
  listContainer: {
    width: 'min-content',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5em',
  },
  newButton: {
    justifySelf: 'flex-end',
    marginLeft: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
  },
  paginationMenu: {
    padding: '0.5em',
    display: 'flex',
    gap: '0.5em',
    justifyContent: 'center',
  },
  tr: {
    cursor: 'pointer',
    '& tr': {
      backgroundColor: '#ddd',
    },
  },
  th: { padding: '0.5em', border: '1px solid #ddd', margin: '0px' },
  td: { padding: '0.5em', border: '1px solid #ddd', margin: '0px' },
};

const DefaultListComponent = ({
  definition,
  columnNames,
  rows,
  crudActions,
  listActions,
  pagination,
}) => (
  <div style={defaultStyles.listContainer}>
    <div style={defaultStyles.tableHeader}>
      <div>{definition.pluralName}</div>
      <button
        style={defaultStyles.newButton}
        onClick={crudActions.goToNewObject}
      >
        add {definition.name}
      </button>
    </div>
    <table style={defaultStyles.table}>
      <thead>
        <tr>
          {columnNames.map((name, index) => (
            <th
              key={`table-header-${name}-${rows[index]?.object._id}`}
              style={defaultStyles.th}
            >
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ values, object, rowActions }) => (
          <tr
            onClick={() => crudActions.goToObject(object._id)}
            key={`table-row-${object._id}`}
            style={defaultStyles.tr}
          >
            {values.map((value, index) => (
              <td
                key={`table-cell-${columnNames[index]}-${value}-${object._id}`}
                style={defaultStyles.td}
              >
                {`${value}`}
              </td>
            ))}
            <td style={defaultStyles.td}>
              <button
                onClick={event => {
                  event.stopPropagation();
                  rowActions.remove();
                }}
              >
                delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={defaultStyles.paginationMenu}>
      <button onClick={listActions.firstPage} disabled={!pagination?.previous}>
        &lt;&lt;
      </button>
      <button
        onClick={listActions.previousPage}
        disabled={!pagination?.previous}
      >
        &lt;
      </button>
      <div>{pagination?.currentPage}</div>
      <button onClick={listActions.nextPage} disabled={!pagination?.next}>
        &gt;
      </button>
      <button onClick={listActions.lastPage} disabled={!pagination?.next}>
        &gt;&gt;
      </button>
    </div>
  </div>
);

const List = ({
  ListComponent,
  formatField,
  definition,
  pickColumns,
  omitColumns,
  crudActions,
  limit,
  skip,
}) => {
  const [paginationAction, setPaginationAction] = useState({ limit, skip });
  const { fields } = definition;
  const { data = {}, ...rest } = useQuery(
    gql(definition.toGraphQLPaginatedQuery()),
    {
      variables: { paginationAction },
    }
  );
  const paginatedResponse =
    data[definition.graphQLPaginatedQueryCamelCaseName] || {};
  const { items: objects = [] } = paginatedResponse;
  const pagination = getRidOfTheAnnoyingTypenameFieldDeep(
    paginatedResponse.pagination
  );
  const [removeMutation] = useMutation(
    gql(definition.toGraphQLEraseMutation())
  );

  if (omitColumns) {
    omitColumns.forEach(columnName =>
      // eslint-disable-next-line no-param-reassign
      objects.map(object => delete object[columnName])
    );
  }

  const columns = pickColumns || Object.keys(objects[0] || fields || {});
  const columnNames = columns.map(
    columnKey => fields[columnKey]?.label || columnKey
  );

  const rows =
    ListComponent &&
    objects.map(object => ({
      rowActions: {
        edit: () => crudActions.goToObject(object._id),
        remove: () =>
          removeMutation({
            variables: { _id: object._id },
            refetchQueries: [{ query: gql(definition.toGraphQLManyQuery()) }],
          }),
      },
      object,
      values: columns.map(
        key =>
          formatField({
            value: object[key],
            definition: fields[key],
            key,
          }) || object[key]
      ),
    }));

  const nextPage = () => {
    if (pagination.next) {
      setPaginationAction(pagination.next);
    }
  };
  const firstPage = () => {
    if (pagination.first) {
      setPaginationAction(pagination.first);
    }
  };
  const lastPage = () => {
    if (pagination.next) {
      setPaginationAction(pagination.last);
    }
  };
  const previousPage = () => {
    if (pagination.previous) {
      setPaginationAction(pagination.previous);
    }
  };

  const listActions = { nextPage, previousPage, firstPage, lastPage };

  return (
    <ListComponent
      definition={definition}
      crudActions={crudActions}
      listActions={listActions}
      columnNames={columnNames}
      pagination={pagination}
      rows={rows}
    />
  );
};

const getInitialValues = ({ isCreating, definition, id }) => {
  if (isCreating) {
    return { initialValues: {} };
  }

  const { data = {}, ...queryRest } = useQuery(
    gql(definition.toGraphQLOneQuery()),
    {
      variables: { _id: id },
    }
  );
  const { [definition.nameCamelCase]: editingObject } = data;

  return { initialValues: editingObject, ...queryRest };
};

const FormComponent = ({ isCreating, definition, formProps, crudActions }) => {
  const { id } = useParams();
  const [saveObjectMutation] = useMutation(
    gql(definition.toGraphQLSaveMutation())
  );
  const { initialValues, loading } = getInitialValues({
    isCreating,
    definition,
    id,
  });

  if (loading) {
    return null;
  }

  return (
    <Form
      initialValues={initialValues}
      definition={definition}
      onSubmit={values => {
        saveObjectMutation({
          variables: {
            [definition.nameCamelCase]: {
              _id: isCreating ? undefined : id,
              ...definition.toSimpleSchema().clean(values),
            },
          },
          refetchQueries: [{ query: gql(definition.toGraphQLManyQuery()) }],
        });

        crudActions.goToList();
      }}
      onClick={event => event.stopPropagation()}
      {...formProps}
    />
  );
};

export const Crud = ({
  limit = 10,
  skip = 0,
  definition,
  formatValue: rawFormatValue,
  pickColumns,
  omitColumns,
  formProps: rawFormProps = {},
  listComponent = DefaultListComponent,
}) => {
  const match = useRouteMatch();
  const history = useHistory();

  const formatField = (...args) =>
    rawFormatValue?.(...args) ?? defaultFormatValue(...args);
  const goToList = () => {
    history.push(`${match.path}`);
  };
  const goToObject = objectId => {
    history.push(buildRoute([match.path, objectId]));
  };
  const goToNewObject = () => {
    history.push(buildRoute([match.path, 'new']));
  };

  const crudActions = { goToList, goToObject, goToNewObject };

  // Inject Save and Cancel buttons
  const formProps = {
    ...rawFormProps,
    actions: [
      ...(rawFormProps.actions || []),
      props => (
        <button
          onClick={history.goBack}
          style={{ marginRight: '1em' }}
          {...props}
        >
          cancel
        </button>
      ),
      props => (
        <button type="submit" {...props}>
          save
        </button>
      ),
    ],
  };

  return (
    <Switch>
      <Route exact path={buildRoute([match.path, 'new'])}>
        <FormComponent
          definition={definition}
          isCreating={true}
          formProps={formProps}
          crudActions={crudActions}
        />
      </Route>
      <Route path={buildRoute([match.path, ':id'])}>
        <FormComponent
          definition={definition}
          formProps={formProps}
          crudActions={crudActions}
        />
      </Route>
      <Route path={match.path}>
        <List
          definition={definition}
          formatField={formatField}
          omitColumns={omitColumns}
          pickColumns={pickColumns}
          ListComponent={listComponent}
          crudActions={crudActions}
          limit={limit}
          skip={skip}
        />
      </Route>
    </Switch>
  );
};
